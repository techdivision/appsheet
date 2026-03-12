# SOSO-440: Write Conversion Policy — Locale-aware Formatierung beim Schreiben

## Status: Konzept

| Feld       | Wert                                                          |
| ---------- | ------------------------------------------------------------- |
| JIRA       | SOSO-440                                                      |
| GitHub     | #17 (Enhancement)                                             |
| Version    | v3.4.0 (geplant)                                              |
| Abhaengig  | SOSO-439 (Locale-aware Validation, in `develop`)              |
| Betrifft   | DynamicTable, DynamicTableFactory, FormatValidator, Policies  |
| Prioritaet | Mittel — funktioniert aktuell durch ISO-Toleranz von AppSheet |

---

## Problemanalyse

### Ausgangslage nach SOSO-439

SOSO-439 loest das **Lesen/Validieren** von Locale-formatierten Daten:

```
1. find()   → AppSheet gibt:  "03/11/2026 21:51:24"  (en-US Locale)
2. update() → Validator akzeptiert jetzt Locale-Format  ✅
3.          → Wir senden das Locale-Format zurueck an AppSheet
4.          → AppSheet versteht es dank Properties.Locale  ✅
```

### Was fehlt: Aktive Konvertierung beim Schreiben

Wenn ein Consumer ISO 8601 sendet (z.B. `"2026-03-12"`), wird das direkt an
AppSheet weitergereicht. AppSheet **toleriert** ISO wenn `Properties.Locale`
gesetzt ist — aber das ist implizites Verhalten, kein expliziter Vertrag.

```
Aktueller Write-Path:
  User → DynamicTable.add([{ date: "2026-03-12" }])
       → unknownFieldPolicy.apply()
       → validateRows()          ← prueft ob ISO oder Locale-Format gueltig
       → client.add({ rows, properties: { Locale: "de-DE" } })
       → AppSheet empfaengt: "2026-03-12" mit Locale "de-DE"
       → AppSheet: "Ok, ich toleriere ISO"  ← implizit, nicht garantiert
```

### Gewuenschter Write-Path (optional, opt-in)

```
Gewuenschter Write-Path (mit WriteConversionPolicy):
  User → DynamicTable.add([{ date: "2026-03-12" }])
       → unknownFieldPolicy.apply()
       → validateRows()          ← prueft ob ISO oder Locale-Format gueltig
       → writeConversionPolicy.apply()  ← NEU: konvertiert ISO → Locale
       → client.add({ rows: [{ date: "12.03.2026" }], properties: { Locale: "de-DE" } })
       → AppSheet empfaengt: "12.03.2026" mit Locale "de-DE"  ← explizit korrekt
```

---

## Architektur-Entscheidungen

### E1: Strategy Pattern (analog UnknownFieldPolicyInterface)

**Entscheidung**: Interface + injizierbare Implementierungen, kein Boolean-Flag.

**Begruendung**:

- Konsistent mit bestehender Architektur (`UnknownFieldPolicyInterface`)
- Erweiterbar fuer Phase 2 (Percent, Price, Time, Duration)
- Testbar (Mock-Policy, Custom-Policies)
- Consumer kann eigene Policies implementieren

### E2: Konvertierung NACH Validation

**Entscheidung**: `validate → convert → send`

**Begruendung**:
Die Validation stellt sicher, dass nur gueltige Werte konvertiert werden.
Wuerde die Konvertierung vor der Validation stattfinden, koennte sie auf
ungueltige Eingaben angewendet werden und entweder crashen oder irrefuehrende
Fehlermeldungen erzeugen.

```
validate("abc-xyz")   → ❌ "Kein gueltiges Datum" — klare Fehlermeldung
convert()             → wird nie erreicht

validate("2026-03-12") → ✅ ISO ist gueltig
convert("2026-03-12")  → "12.03.2026" — sicher, weil Input validiert
```

### E3: NoOp als Default

**Entscheidung**: Standard-Policy konvertiert nichts (NoOp).

**Begruendung**:

- Kein Breaking Change
- Explizites Opt-in durch Consumer
- Backward-kompatibel: bestehender Code funktioniert weiter

### E4: Phase 1 + Phase 2 Erweiterbarkeit

**Entscheidung**: Interface-Design erlaubt beliebige Feldtyp-Konvertierungen.
Phase 1 implementiert nur Date/DateTime/ChangeTimestamp.

---

## Interface-Design

### WriteConversionPolicyInterface

**Datei**: `src/types/policies.ts` (erweitert bestehende Datei)

```typescript
/**
 * Interface for converting field values before sending to AppSheet API.
 *
 * Implementations can convert values to locale-specific formats (e.g., ISO dates
 * to locale dates), normalize values, or perform any other pre-write transformation.
 *
 * The policy is applied AFTER validation but BEFORE sending to the API,
 * ensuring only valid values are converted.
 *
 * @category Types
 */
export interface WriteConversionPolicyInterface {
  /**
   * Convert field values in rows before sending to AppSheet API.
   *
   * @param tableName - The AppSheet table name (for context/logging)
   * @param rows - The validated row objects to convert
   * @param fields - Field definitions from the table schema
   * @param locale - Optional BCP 47 locale tag for locale-aware conversion
   * @returns Converted rows (may have transformed field values)
   */
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    fields: Record<string, FieldDefinition>,
    locale?: string
  ): Partial<T>[];
}
```

**Design-Unterschiede zu UnknownFieldPolicyInterface**:

| Aspekt           | UnknownFieldPolicy       | WriteConversionPolicy                 |
| ---------------- | ------------------------ | ------------------------------------- |
| Zweck            | Felder filtern/pruefen   | Feldwerte transformieren              |
| Input-Kontext    | `knownFields: string[]`  | `fields: Record<string, FieldDef>`    |
| Locale           | nicht relevant           | `locale?: string` (fuer Formatierung) |
| Mutation         | Filtert Felder (Spalten) | Transformiert Werte (Zellinhalte)     |
| Position im Path | Vor Validation           | Nach Validation                       |

Die Policy bekommt `fields` statt `knownFields`, weil sie den **Feldtyp**
kennen muss (Date, DateTime, Percent, etc.) um zu wissen, welche Felder
konvertiert werden muessen.

---

## Implementierungen

### NoOpWriteConversionPolicy (Default)

**Datei**: `src/utils/policies/NoOpWriteConversionPolicy.ts`

```typescript
/**
 * No-op write conversion policy.
 *
 * Passes all rows through without any conversion. This is the default
 * policy, maintaining backward compatibility.
 *
 * @category Policies
 */
export class NoOpWriteConversionPolicy implements WriteConversionPolicyInterface {
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    _fields: Record<string, FieldDefinition>,
    _locale?: string
  ): Partial<T>[] {
    return rows;
  }
}
```

### LocaleWriteConversionPolicy (Phase 1: Date/DateTime)

**Datei**: `src/utils/policies/LocaleWriteConversionPolicy.ts`

````typescript
import { FieldDefinition, WriteConversionPolicyInterface } from '../../types';
import { getLocaleDateFormat, DateFormatInfo } from '../validators';

/** AppSheet field types that contain date values */
const DATE_TYPES = new Set(['Date', 'DateTime', 'ChangeTimestamp']);

/** ISO 8601 date pattern */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601 datetime pattern */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Converts ISO 8601 date/datetime values to locale-specific format
 * before sending to AppSheet API.
 *
 * Only converts values that are in ISO format. Values already in
 * locale format or other formats are passed through unchanged.
 *
 * Requires a locale to be set. Without locale, acts as no-op.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { LocaleWriteConversionPolicy, DynamicTableFactory } from '@techdivision/appsheet';
 *
 * const factory = new DynamicTableFactory(
 *   clientFactory,
 *   schema,
 *   undefined,                          // default unknown field policy
 *   new LocaleWriteConversionPolicy()   // convert dates on write
 * );
 * ```
 */
export class LocaleWriteConversionPolicy implements WriteConversionPolicyInterface {
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    fields: Record<string, FieldDefinition>,
    locale?: string
  ): Partial<T>[] {
    // Without locale, no conversion possible
    if (!locale) return rows;

    const fmt = getLocaleDateFormat(locale);

    return rows.map((row) => {
      const converted = { ...row } as Record<string, any>;

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (!DATE_TYPES.has(fieldDef.type)) continue;

        const value = converted[fieldName];
        if (typeof value !== 'string') continue;

        converted[fieldName] = this.convertDateValue(value, fieldDef.type, fmt);
      }

      return converted as Partial<T>;
    });
  }

  /**
   * Converts a single date/datetime value from ISO to locale format.
   * Returns the original value if it's not in ISO format.
   */
  private convertDateValue(value: string, fieldType: string, fmt: DateFormatInfo): string {
    if (fieldType === 'Date' && ISO_DATE.test(value)) {
      return this.isoDateToLocale(value, fmt);
    }

    if ((fieldType === 'DateTime' || fieldType === 'ChangeTimestamp') && ISO_DATETIME.test(value)) {
      return this.isoDateTimeToLocale(value, fmt);
    }

    // Not ISO format — pass through unchanged
    return value;
  }

  /**
   * Converts ISO date (YYYY-MM-DD) to locale format.
   *
   * @example
   * isoDateToLocale("2026-03-12", deDE) → "12.03.2026"
   * isoDateToLocale("2026-03-12", enUS) → "03/12/2026"
   * isoDateToLocale("2026-03-12", jaJP) → "2026/03/12"
   */
  private isoDateToLocale(isoDate: string, fmt: DateFormatInfo): string {
    const [year, month, day] = isoDate.split('-');
    const parts: Record<string, string> = { year, month, day };
    return fmt.partOrder.map((p) => parts[p]).join(fmt.separator);
  }

  /**
   * Converts ISO datetime (YYYY-MM-DDT...) to locale format.
   *
   * @example
   * isoDateTimeToLocale("2026-03-12T14:30:00.000Z", deDE) → "12.03.2026 14:30:00"
   * isoDateTimeToLocale("2026-03-12T14:30:00Z", enUS)     → "03/12/2026 14:30:00"
   */
  private isoDateTimeToLocale(isoDateTime: string, fmt: DateFormatInfo): string {
    // Parse: "2026-03-12T14:30:00.000Z" or "2026-03-12T14:30:00+02:00"
    const tIndex = isoDateTime.indexOf('T');
    const datePart = isoDateTime.substring(0, tIndex);
    let timePart = isoDateTime.substring(tIndex + 1);

    // Strip timezone suffix (Z, +HH:MM, -HH:MM)
    timePart = timePart.replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '');

    // Strip milliseconds (.000)
    timePart = timePart.replace(/\.\d+$/, '');

    const localDate = this.isoDateToLocale(datePart, fmt);
    return `${localDate} ${timePart}`;
  }
}
````

---

## Integration in DynamicTable

### Aktueller Write-Path (v3.3.0)

```typescript
// DynamicTable.add() — aktuell
async add(rows: Partial<T>[]): Promise<T[]> {
  // STEP 1: Unknown field policy
  const processedRows = this.unknownFieldPolicy.apply<T>(...);

  // STEP 2: Validate
  this.validateRows(processedRows);

  // STEP 3: Send to API
  const result = await this.client.add<T>({ ... });
  return result.rows;
}
```

### Neuer Write-Path (v3.4.0)

```typescript
// DynamicTable.add() — neu
async add(rows: Partial<T>[]): Promise<T[]> {
  // STEP 1: Unknown field policy (unveraendert)
  const processedRows = this.unknownFieldPolicy.apply<T>(...);

  // STEP 2: Validate (unveraendert)
  this.validateRows(processedRows);

  // STEP 3: Write conversion (NEU)
  const convertedRows = this.writeConversionPolicy.apply<T>(
    this.definition.tableName,
    processedRows,
    this.definition.fields,
    this.definition.locale
  );

  // STEP 4: Send to API
  const result = await this.client.add<T>({
    tableName: this.definition.tableName,
    rows: convertedRows as T[],
    properties: this.definition.locale ? { Locale: this.definition.locale } : undefined,
  });
  return result.rows;
}
```

### DynamicTable Constructor-Erweiterung

```typescript
export class DynamicTable<T extends Record<string, any> = Record<string, any>> {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;
  private readonly writeConversionPolicy: WriteConversionPolicyInterface; // NEU

  constructor(
    private client: AppSheetClientInterface,
    private definition: TableDefinition,
    unknownFieldPolicy?: UnknownFieldPolicyInterface,
    writeConversionPolicy?: WriteConversionPolicyInterface // NEU
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
    this.writeConversionPolicy = writeConversionPolicy ?? new NoOpWriteConversionPolicy();
  }
}
```

### DynamicTableFactory Constructor-Erweiterung

```typescript
export class DynamicTableFactory implements DynamicTableFactoryInterface {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;
  private readonly writeConversionPolicy: WriteConversionPolicyInterface; // NEU

  constructor(
    private readonly clientFactory: AppSheetClientFactoryInterface,
    private readonly schema: SchemaConfig,
    unknownFieldPolicy?: UnknownFieldPolicyInterface,
    writeConversionPolicy?: WriteConversionPolicyInterface // NEU
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
    this.writeConversionPolicy = writeConversionPolicy ?? new NoOpWriteConversionPolicy();
  }

  create<T extends Record<string, any> = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    // ... (existierende Logik) ...

    return new DynamicTable<T>(
      client,
      resolvedTableDef,
      this.unknownFieldPolicy,
      this.writeConversionPolicy // NEU: durchreichen
    );
  }
}
```

### Betroffene Methoden in DynamicTable

| Methode     | Conversion? | Begruendung                                |
| ----------- | ----------- | ------------------------------------------ |
| `add()`     | Ja          | Neue Rows werden geschrieben               |
| `update()`  | Ja          | Bestehende Rows werden aktualisiert        |
| `delete()`  | Nein        | Nur Key-Felder, keine Datumswerte relevant |
| `find()`    | Nein        | Lese-Operation, keine Werte gesendet       |
| `findAll()` | Nein        | Lese-Operation                             |
| `findOne()` | Nein        | Lese-Operation                             |

---

## Phase 2: Erweiterbarkeit fuer weitere Feldtypen

### Offene Recherche: Was erwartet die AppSheet API?

Bevor Phase 2 implementiert wird, muss geprueft werden, welches Format die
AppSheet API tatsaechlich fuer diese Feldtypen erwartet:

| Feldtyp    | Frage                                            | Zu pruefen                       |
| ---------- | ------------------------------------------------ | -------------------------------- |
| `Percent`  | Erwartet API `0.5` oder `50%` oder `50`?         | AppSheet Doku + empirischer Test |
| `Price`    | Erwartet API `19.99` oder `19,99` oder `€19.99`? | Abhaengig von Locale?            |
| `Decimal`  | Dezimaltrenner: `.` oder `,` je nach Locale?     | AppSheet API Verhalten testen    |
| `Time`     | Format: `HH:mm:ss` oder locale-abhaengig?        | 12h vs 24h Format?               |
| `Duration` | Format: `HH:MM:SS` oder Sekunden als Zahl?       | AppSheet Doku pruefen            |

### Wie das Interface Phase 2 unterstuetzt

Die `LocaleWriteConversionPolicy` kann ohne Interface-Aenderung um
weitere Feldtypen erweitert werden:

```typescript
// Phase 2 Erweiterung (Pseudo-Code)
class LocaleWriteConversionPolicy implements WriteConversionPolicyInterface {
  apply<T>(tableName, rows, fields, locale): Partial<T>[] {
    if (!locale) return rows;
    const fmt = getLocaleDateFormat(locale);

    return rows.map((row) => {
      const converted = { ...row };
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const value = converted[fieldName];

        switch (fieldDef.type) {
          // Phase 1 (bereits implementiert)
          case 'Date':
          case 'DateTime':
          case 'ChangeTimestamp':
            converted[fieldName] = this.convertDateValue(value, fieldDef.type, fmt);
            break;

          // Phase 2 (Zukunft)
          case 'Percent':
            converted[fieldName] = this.convertPercent(value, locale);
            break;
          case 'Price':
            converted[fieldName] = this.convertPrice(value, locale);
            break;
          case 'Decimal':
            converted[fieldName] = this.convertDecimal(value, locale);
            break;
        }
      }
      return converted;
    });
  }
}
```

Alternativ koennte Phase 2 als separate Policy implementiert werden
(`NumericLocaleWriteConversionPolicy`), die mit der bestehenden
`LocaleWriteConversionPolicy` kombiniert wird — z.B. ueber eine
`CompositeWriteConversionPolicy`:

```typescript
/**
 * Kombiniert mehrere Write-Conversion-Policies sequentiell.
 * Jede Policy transformiert die Ausgabe der vorherigen.
 */
class CompositeWriteConversionPolicy implements WriteConversionPolicyInterface {
  constructor(private readonly policies: WriteConversionPolicyInterface[]) {}

  apply<T>(tableName, rows, fields, locale): Partial<T>[] {
    let result = rows;
    for (const policy of this.policies) {
      result = policy.apply(tableName, result, fields, locale);
    }
    return result;
  }
}

// Nutzung:
const conversion = new CompositeWriteConversionPolicy([
  new LocaleWriteConversionPolicy(), // Phase 1: Dates
  new NumericLocaleWriteConversionPolicy(), // Phase 2: Percent, Price
]);
```

---

## Dateiuebersicht

### Neue Dateien

| Datei                                                      | Beschreibung                     |
| ---------------------------------------------------------- | -------------------------------- |
| `src/utils/policies/NoOpWriteConversionPolicy.ts`          | Default: keine Konvertierung     |
| `src/utils/policies/LocaleWriteConversionPolicy.ts`        | ISO → Locale Datumskonvertierung |
| `tests/utils/policies/NoOpWriteConversionPolicy.test.ts`   | Tests fuer NoOp Policy           |
| `tests/utils/policies/LocaleWriteConversionPolicy.test.ts` | Tests fuer Locale-Konvertierung  |
| `tests/client/DynamicTable.writeConversion.test.ts`        | Integrationstests im Write-Path  |

### Geaenderte Dateien

| Datei                               | Aenderung                                                          | Breaking? |
| ----------------------------------- | ------------------------------------------------------------------ | --------- |
| `src/types/policies.ts`             | `WriteConversionPolicyInterface` hinzufuegen                       | Nein      |
| `src/client/DynamicTable.ts`        | Neuer Constructor-Parameter, Conversion-Step in `add()`/`update()` | Nein      |
| `src/client/DynamicTableFactory.ts` | Neuer Constructor-Parameter, durchreichen an DynamicTable          | Nein      |
| `src/utils/policies/index.ts`       | Exports fuer neue Policies                                         | Nein      |
| `src/index.ts`                      | Re-Exports                                                         | Nein      |

---

## Test-Strategie

### Unit-Tests: NoOpWriteConversionPolicy

```typescript
describe('NoOpWriteConversionPolicy', () => {
  it('should return rows unchanged', () => {
    const policy = new NoOpWriteConversionPolicy();
    const rows = [{ date: '2026-03-12', name: 'Test' }];
    const fields = { date: { type: 'Date' }, name: { type: 'Text' } };
    const result = policy.apply('table', rows, fields, 'de-DE');
    expect(result).toEqual(rows);
  });

  it('should return rows unchanged without locale', () => {
    const policy = new NoOpWriteConversionPolicy();
    const rows = [{ date: '2026-03-12' }];
    const result = policy.apply('table', rows, { date: { type: 'Date' } });
    expect(result).toEqual(rows);
  });
});
```

### Unit-Tests: LocaleWriteConversionPolicy

```typescript
describe('LocaleWriteConversionPolicy', () => {
  const policy = new LocaleWriteConversionPolicy();

  describe('Date conversion', () => {
    const fields = { date: { type: 'Date' }, name: { type: 'Text' } };

    it('should convert ISO date to de-DE format', () => {
      const rows = [{ date: '2026-03-12', name: 'Test' }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
      expect(result[0].name).toBe('Test'); // Non-date fields unchanged
    });

    it('should convert ISO date to en-US format', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, fields, 'en-US');
      expect(result[0].date).toBe('03/12/2026');
    });

    it('should convert ISO date to ja-JP format', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, fields, 'ja-JP');
      expect(result[0].date).toBe('2026/03/12');
    });

    it('should pass through non-ISO dates unchanged', () => {
      const rows = [{ date: '12.03.2026' }]; // Already in de-DE
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
    });

    it('should not mutate original rows', () => {
      const rows = [{ date: '2026-03-12' }];
      const original = { ...rows[0] };
      policy.apply('t', rows, fields, 'de-DE');
      expect(rows[0]).toEqual(original);
    });
  });

  describe('DateTime conversion', () => {
    const fields = { created: { type: 'DateTime' } };

    it('should convert ISO datetime to de-DE format', () => {
      const rows = [{ created: '2026-03-12T14:30:00.000Z' }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should convert ISO datetime with timezone offset', () => {
      const rows = [{ created: '2026-03-12T14:30:00+02:00' }];
      const result = policy.apply('t', rows, fields, 'en-US');
      expect(result[0].created).toBe('03/12/2026 14:30:00');
    });

    it('should convert ISO datetime without timezone', () => {
      const rows = [{ created: '2026-03-12T14:30:00' }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should pass through non-ISO datetimes unchanged', () => {
      const rows = [{ created: '12.03.2026 14:30:00' }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });
  });

  describe('ChangeTimestamp conversion', () => {
    const fields = { modified: { type: 'ChangeTimestamp' } };

    it('should convert ChangeTimestamp like DateTime', () => {
      const rows = [{ modified: '2026-03-12T14:30:00Z' }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].modified).toBe('12.03.2026 14:30:00');
    });
  });

  describe('without locale', () => {
    it('should act as no-op without locale', () => {
      const fields = { date: { type: 'Date' } };
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, fields);
      expect(result[0].date).toBe('2026-03-12');
    });
  });

  describe('non-date fields', () => {
    it('should not touch Text fields', () => {
      const fields = { name: { type: 'Text' }, count: { type: 'Number' } };
      const rows = [{ name: 'Test', count: 42 }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result).toEqual(rows);
    });

    it('should handle null/undefined values', () => {
      const fields = { date: { type: 'Date' } };
      const rows = [{ date: undefined }, { date: null }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].date).toBeUndefined();
      expect(result[1].date).toBeNull();
    });
  });

  describe('multiple rows', () => {
    it('should convert all rows', () => {
      const fields = { date: { type: 'Date' } };
      const rows = [
        { date: '2026-03-12' },
        { date: '2026-12-25' },
        { date: '12.03.2026' }, // Already locale → pass through
      ];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
      expect(result[1].date).toBe('25.12.2026');
      expect(result[2].date).toBe('12.03.2026');
    });
  });
});
```

### Integrationstests: DynamicTable mit WriteConversionPolicy

```typescript
describe('DynamicTable with WriteConversionPolicy', () => {
  it('should apply write conversion in add()', async () => {
    const table = new DynamicTable(
      mockClient,
      tableDef,
      undefined, // default unknown field policy
      new LocaleWriteConversionPolicy()
    );
    await table.add([{ id: '1', date: '2026-03-12' }]);

    // Verify client received converted date
    expect(mockClient.add).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ date: '12.03.2026' })],
      })
    );
  });

  it('should apply write conversion in update()', async () => {
    const table = new DynamicTable(
      mockClient,
      tableDef,
      undefined,
      new LocaleWriteConversionPolicy()
    );
    await table.update([{ id: '1', date: '2026-03-12' }]);

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ date: '12.03.2026' })],
      })
    );
  });

  it('should NOT apply write conversion in delete()', async () => {
    const table = new DynamicTable(
      mockClient,
      tableDefWithDateKey,
      undefined,
      new LocaleWriteConversionPolicy()
    );
    await table.delete([{ id: '1' }]);

    // delete() should pass keys through unchanged
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [{ id: '1' }],
      })
    );
  });

  it('should use NoOp by default (backward compatible)', async () => {
    const table = new DynamicTable(mockClient, tableDef);
    await table.add([{ id: '1', date: '2026-03-12' }]);

    // ISO should be sent unchanged
    expect(mockClient.add).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ date: '2026-03-12' })],
      })
    );
  });
});
```

---

## Consumer-Nutzung

### MCP-Server Beispiel

```typescript
import {
  AppSheetClientFactory,
  DynamicTableFactory,
  SchemaLoader,
  SchemaManager,
  LocaleWriteConversionPolicy,
} from '@techdivision/appsheet';

// Opt-in: Enable locale write conversion
const clientFactory = new AppSheetClientFactory();
const schema = SchemaLoader.fromYaml('./schema.yaml');

const tableFactory = new DynamicTableFactory(
  clientFactory,
  schema,
  undefined, // default unknown field policy (Strip)
  new LocaleWriteConversionPolicy() // convert ISO dates to locale format
);

const db = new SchemaManager(tableFactory);

// Now all write operations automatically convert dates
const table = db.table('default', 'worklogs', 'user@example.com');
await table.add([{ date: '2026-03-12' }]);
// → AppSheet receives: { date: "12.03.2026" } with Locale: "de-DE"
```

### Direkter DynamicTable-Einsatz

```typescript
import { DynamicTable, LocaleWriteConversionPolicy } from '@techdivision/appsheet';

const table = new DynamicTable(
  client,
  tableDefinition,
  undefined, // default strip policy
  new LocaleWriteConversionPolicy()
);

await table.add([{ date: '2026-03-12' }]);
// Converted to locale format before sending
```

---

## Risikobewertung

| Risiko                                      | Einstufung  | Mitigation                                                             |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| Breaking Change                             | Kein Risiko | Neuer optionaler Parameter, Default ist NoOp                           |
| Doppel-Konvertierung (bereits im Locale)    | Niedrig     | Policy erkennt ISO-Pattern und konvertiert nur ISO-Werte               |
| Timezone-Verlust bei DateTime-Konvertierung | Niedrig     | AppSheet arbeitet nicht mit Timezones; Locale-Format hat keine TZ-Info |
| Phase 2 erfordert API-Recherche             | Mittel      | Eigenes Issue vor Implementierung                                      |
| Constructor-Reihenfolge der Parameter       | Niedrig     | Optionale Parameter am Ende, bestehende Signatur bleibt kompatibel     |

---

## Implementierungsplan

| Phase                              | Aufwand | Beschreibung                                                |
| ---------------------------------- | ------- | ----------------------------------------------------------- |
| 1. Interface                       | 0.5h    | `WriteConversionPolicyInterface` in `src/types/policies.ts` |
| 2. NoOpWriteConversionPolicy       | 0.5h    | Default-Implementierung + Tests                             |
| 3. LocaleWriteConversionPolicy     | 2h      | Date/DateTime/ChangeTimestamp Konvertierung + Tests         |
| 4. DynamicTable Integration        | 1h      | Constructor, `add()`, `update()` erweitern + Tests          |
| 5. DynamicTableFactory Integration | 0.5h    | Constructor-Parameter durchreichen                          |
| 6. Exports                         | 0.5h    | `src/utils/policies/index.ts`, `src/index.ts`               |
| 7. Dokumentation                   | 1h      | CLAUDE.md, Code-Beispiele                                   |
| **Gesamt**                         | **~6h** | **1 Tag**                                                   |

---

## Offene Fragen

1. **SchemaManager Constructor**: Aktuell nimmt `SchemaManager` eine `DynamicTableFactoryInterface`.
   Die `WriteConversionPolicy` wird ueber die `DynamicTableFactory` injiziert.
   Soll `SchemaManager` alternativ auch direkt eine Policy akzeptieren (Convenience)?
   → Empfehlung: Nein, ueber Factory reicht. Haelt SchemaManager schlank.

2. **Phase 2 Timing**: Wann soll die API-Recherche fuer Percent/Price/Decimal stattfinden?
   → Empfehlung: Eigenes Issue (SOSO-441?) erstellen, nicht blockierend fuer Phase 1.

3. **CompositeWriteConversionPolicy**: Soll die Composite-Policy Teil von Phase 1 sein?
   → Empfehlung: Nein, erst wenn Phase 2 tatsaechlich kommt. YAGNI.
