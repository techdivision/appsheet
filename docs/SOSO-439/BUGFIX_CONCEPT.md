# SOSO-439: Locale-aware Date/DateTime Validation

## Status: Konzept

| Feld       | Wert                                                |
| ---------- | --------------------------------------------------- |
| JIRA       | SOSO-439                                            |
| GitHub     | #15 (Enhancement), #14 (Bug, closed as duplicate)   |
| Version    | v3.3.0 (geplant)                                    |
| Betrifft   | FormatValidator, Schema, AppSheetClient             |
| Prioritaet | Hoch — blockiert Update/Delete bei DateTime-Feldern |

---

## Problemanalyse

### Symptom

`DynamicTable.update()` und `DynamicTable.delete()` schlagen fehl auf Tabellen mit
Date/DateTime-Feldern, weil der eigene Validator das von AppSheet zurueckgegebene
Locale-Format rejected.

### Ablauf der den Fehler ausloest

```
1. add()    → Wir senden:    "2026-03-11T21:51:24.000Z"  (ISO 8601)
2. find()   → AppSheet gibt:  "03/11/2026 21:51:24"       (en-US Locale)
3. update() → Wir senden:    "03/11/2026 21:51:24"        (Locale-Format)
             → UNSER Validator: ValidationError "must be ISO 8601"
             → Erreicht AppSheet gar nicht
```

### Root Causes (3 Stueck)

| #   | Root Cause                                    | Wo                                             |
| --- | --------------------------------------------- | ---------------------------------------------- |
| 1   | FormatValidator akzeptiert nur ISO 8601       | `FormatValidator.ts:60,72`                     |
| 2   | Schema hat kein Locale-Feld                   | `TableDefinition`, `ConnectionDefinition`      |
| 3   | AppSheetClient sendet kein Locale in Requests | `mergeProperties()` setzt nur `RunAsUserEmail` |

---

## Loesung: Locale ins Schema + Locale-aware Validation

### Architektur-Entscheidung

Das Locale definiert:

- Welches **Datumsformat** AppSheet erwartet und zurueckgibt
- Welches **Zahlenformat** (Dezimaltrennzeichen) gilt
- Welches Format der **MCP-Server** dem User/LLM kommuniziert

Das Locale muss **pro Tabelle** konfigurierbar sein, weil:

- Eine Connection kann mehrere Apps/Tabellen mit verschiedenen Locales bedienen
- AppSheet sendet das Locale als `Properties.Locale` pro Request
- Verschiedene Tabellen koennten verschiedene regionale Einstellungen haben

### Locale-Aufloesung (Kaskade)

```
Tabellen-Locale  →  Connection-Locale  →  undefined (permissiver Modus)
   (hoechste)          (mittel)             (niedrigste)
```

Beispiel:

```yaml
connections:
  default:
    appId: ${APP_ID}
    applicationAccessKey: ${ACCESS_KEY}
    locale: de-DE # Connection-Default
    tables:
      worklogs:
        tableName: extract_worklog
        keyField: worklog_id
        locale: en-US # Tabellen-Override → en-US gewinnt
        fields:
          date: { type: Date }
      users:
        tableName: extract_user
        keyField:
          user_id
          # Kein Tabellen-Locale → de-DE (von Connection)
        fields:
          name: { type: Text }
```

---

## Betroffene Dateien

### Schema-Typen erweitern

**`src/types/schema.ts`** — `TableDefinition` und `ConnectionDefinition`

```typescript
export interface TableDefinition {
  tableName: string;
  keyField: string;
  locale?: string; // NEU: z.B. "de-DE", "en-US"
  fields: Record<string, FieldDefinition>;
}

export interface ConnectionDefinition {
  appId: string;
  applicationAccessKey: string;
  baseUrl?: string;
  timeout?: number;
  runAsUserEmail?: string;
  locale?: string; // NEU: Default-Locale fuer alle Tabellen
  tables: Record<string, TableDefinition>;
}
```

### Locale-Format-Erkennung via `Intl.DateTimeFormat`

**`src/utils/validators/FormatValidator.ts`** — dynamische Locale-aware Validierung

Statt einer hardcoded `LOCALE_FORMATS`-Map mit manuellen Regex-Patterns nutzen wir
`Intl.DateTimeFormat.formatToParts()` um dynamisch fuer **jedes beliebige Locale**
das korrekte Datumsformat zu erkennen. Die JavaScript-Runtime unterstuetzt hunderte
Locales nativ — es muss kein einziges manuell gepflegt werden.

**Beispiele** (automatisch durch `Intl.DateTimeFormat` erkannt):

| Locale | Date-Format | DateTime-Format            | Ermittelt durch                      |
| ------ | ----------- | -------------------------- | ------------------------------------ |
| en-US  | MM/DD/YYYY  | MM/DD/YYYY HH:mm:ss        | `Intl.DateTimeFormat('en-US')`       |
| en-GB  | DD/MM/YYYY  | DD/MM/YYYY HH:mm:ss        | `Intl.DateTimeFormat('en-GB')`       |
| de-DE  | DD.MM.YYYY  | DD.MM.YYYY HH:mm:ss        | `Intl.DateTimeFormat('de-DE')`       |
| fr-FR  | DD/MM/YYYY  | DD/MM/YYYY HH:mm:ss        | `Intl.DateTimeFormat('fr-FR')`       |
| ja-JP  | YYYY/MM/DD  | YYYY/MM/DD HH:mm:ss        | `Intl.DateTimeFormat('ja-JP')`       |
| zh-CN  | YYYY/MM/DD  | YYYY/MM/DD HH:mm:ss        | `Intl.DateTimeFormat('zh-CN')`       |
| ISO    | YYYY-MM-DD  | YYYY-MM-DDThh:mm:ss[Z/±TZ] | Hardcoded Regex (immer als Fallback) |

**Wichtig**: ISO 8601 wird **immer** als Fallback akzeptiert, unabhaengig vom Locale.
AppSheet toleriert ISO bei Add-Operationen, und es ist das natuerliche JavaScript-Format.

```typescript
// ============================================
// Dynamische Locale-Format-Erkennung
// ============================================

interface DateFormatInfo {
  /** Reihenfolge der Teile, z.B. ['month','day','year'] fuer en-US */
  partOrder: ('day' | 'month' | 'year')[];
  /** Trennzeichen, z.B. '/' oder '.' */
  separator: string;
  /** Beispiel-Datum formatiert, z.B. "12/25/2026" — fuer Error Messages */
  exampleDate: string;
  /** Beispiel-DateTime formatiert, z.B. "12/25/2026 14:30:00" */
  exampleDateTime: string;
}

// Cache: Einmal pro Locale berechnen, dann wiederverwenden
const formatCache = new Map<string, DateFormatInfo>();

/**
 * Ermittelt dynamisch das Datumsformat fuer ein beliebiges Locale
 * via Intl.DateTimeFormat.formatToParts().
 *
 * Unterstuetzt ALLE Locales die die JavaScript-Runtime kennt (hunderte).
 * Ergebnis wird pro Locale gecached.
 */
function getLocaleDateFormat(locale: string): DateFormatInfo {
  const cached = formatCache.get(locale);
  if (cached) return cached;

  // Referenzdatum: Tag=25, Monat=12, Jahr=2026 — alle unterschiedlich,
  // damit die Reihenfolge eindeutig erkennbar ist
  const refDate = new Date(2026, 11, 25, 14, 30, 0);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dateFmt.formatToParts(refDate);
  const partOrder = parts
    .filter((p) => ['day', 'month', 'year'].includes(p.type))
    .map((p) => p.type as 'day' | 'month' | 'year');
  const separator = parts.find((p) => p.type === 'literal')?.value || '/';

  const info: DateFormatInfo = {
    partOrder,
    separator,
    exampleDate: dateFmt.format(refDate),
    exampleDateTime: dateTimeFmt.format(refDate),
  };

  formatCache.set(locale, info);
  return info;
}

// ISO 8601 Patterns — immer akzeptiert, unabhaengig vom Locale
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;
```

**Vergleich zum alten Ansatz:**

| Aspekt                   | Alt (LOCALE_FORMATS Map)    | Neu (Intl.DateTimeFormat)             |
| ------------------------ | --------------------------- | ------------------------------------- |
| Unterstuetzte Locales    | 4 (en-US, en-GB, de-DE, fr) | **Alle** (hunderte, plattform-nativ)  |
| Wartung                  | Manuelle Regex-Pflege       | Keine — Platform-API                  |
| Semantische Validierung  | Nein (nur Pattern-Match)    | Ja (Month 1-12, Day 1-31, Year-Range) |
| Error Messages           | Statischer Pattern-String   | Echtes Beispieldatum im Locale-Format |
| Neue Locales hinzufuegen | Code-Aenderung noetig       | Automatisch unterstuetzt              |
| Performance              | O(1) Lookup                 | O(1) nach einmaligem Cache-Aufbau     |

### FormatValidator: Signatur-Aenderung

```typescript
// ALT (v3.2.0)
static validateDateFormat(fieldName: string, value: string, rowIndex: number): void

// NEU (v3.3.0)
static validateDateFormat(fieldName: string, value: string, rowIndex: number, locale?: string): void
```

### FormatValidator: Validierungslogik (Date)

```typescript
static validateDateFormat(
  fieldName: string,
  value: string,
  rowIndex: number,
  locale?: string
): void {
  // 1. ISO 8601 immer akzeptiert
  if (ISO_DATE.test(value)) return;

  if (locale) {
    // 2. Mit Locale: Dynamisch Format ermitteln und validieren
    const fmt = getLocaleDateFormat(locale);
    const dateParts = value.split(fmt.separator);
    if (dateParts.length === 3 && validateDateParts(dateParts, fmt.partOrder)) {
      return;
    }

    // Locale-Format nicht erkannt → Error mit Beispiel
    throw new ValidationError(
      `Row ${rowIndex}: Field "${fieldName}" must be a valid date `
        + `(expected: ${fmt.exampleDate} or YYYY-MM-DD), got: "${value}"`,
      { fieldName, value, locale }
    );
  }

  // 3. Ohne Locale → permissiver Modus: akzeptiere wenn plausibel
  if (!isPlausibleDateString(value)) {
    throw new ValidationError(
      `Row ${rowIndex}: Field "${fieldName}" must be a valid date string, got: "${value}"`,
      { fieldName, value }
    );
  }
}
```

### FormatValidator: Validierungslogik (DateTime)

```typescript
static validateDateTimeFormat(
  fieldName: string,
  value: string,
  rowIndex: number,
  locale?: string
): void {
  // 1. ISO 8601 immer akzeptiert
  if (ISO_DATETIME.test(value)) return;

  if (locale) {
    // 2. Mit Locale: Datum-Teil vor dem Leerzeichen, Zeit-Teil danach
    const fmt = getLocaleDateFormat(locale);
    const spaceIndex = value.indexOf(' ');
    if (spaceIndex > 0) {
      const datePart = value.substring(0, spaceIndex);
      const timePart = value.substring(spaceIndex + 1);
      const dateParts = datePart.split(fmt.separator);
      if (
        dateParts.length === 3 &&
        validateDateParts(dateParts, fmt.partOrder) &&
        isValidTimePart(timePart)
      ) {
        return;
      }
    }

    throw new ValidationError(
      `Row ${rowIndex}: Field "${fieldName}" must be a valid datetime `
        + `(expected: ${fmt.exampleDateTime} or ISO 8601), got: "${value}"`,
      { fieldName, value, locale }
    );
  }

  // 3. Ohne Locale → permissiver Modus
  if (!isPlausibleDateTimeString(value)) {
    throw new ValidationError(
      `Row ${rowIndex}: Field "${fieldName}" must be a valid datetime string, got: "${value}"`,
      { fieldName, value }
    );
  }
}
```

### Hilfs-Funktionen fuer semantische Validierung

```typescript
/**
 * Prueft ob die String-Parts gueltige Tag/Monat/Jahr-Werte sind.
 * Semantische Validierung statt reinem Pattern-Match.
 */
function validateDateParts(parts: string[], order: ('day' | 'month' | 'year')[]): boolean {
  const mapped: Record<string, number> = {};
  for (let i = 0; i < order.length; i++) {
    const num = parseInt(parts[i], 10);
    if (isNaN(num)) return false;
    mapped[order[i]] = num;
  }
  return (
    mapped.year >= 1900 &&
    mapped.year <= 9999 &&
    mapped.month >= 1 &&
    mapped.month <= 12 &&
    mapped.day >= 1 &&
    mapped.day <= 31
  );
}

/**
 * Prueft ob ein Time-String gueltig ist (HH:mm oder HH:mm:ss).
 */
function isValidTimePart(time: string): boolean {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(time);
}

/**
 * Permissiver Check: Sieht der String nach einem Datum aus?
 * Gaengige Separatoren: /, ., -
 * Akzeptiert wenn 3 numerische Teile vorhanden.
 */
function isPlausibleDateString(value: string): boolean {
  const parts = value.split(/[\/.\-]/);
  if (parts.length !== 3) return false;
  return parts.every((p) => /^\d{1,4}$/.test(p));
}

/**
 * Permissiver Check: Sieht der String nach einem DateTime aus?
 * Erwartet Datum + Leerzeichen + Zeit.
 */
function isPlausibleDateTimeString(value: string): boolean {
  const spaceIndex = value.indexOf(' ');
  if (spaceIndex <= 0) return false;
  const datePart = value.substring(0, spaceIndex);
  const timePart = value.substring(spaceIndex + 1);
  return isPlausibleDateString(datePart) && isValidTimePart(timePart);
}
```

### AppSheetTypeValidator: Locale durchreichen

```typescript
// ALT
case 'Date':
  if (BaseTypeValidator.validateDateValue(fieldName, value, rowIndex)) {
    if (typeof value === 'string') {
      FormatValidator.validateDateFormat(fieldName, value, rowIndex);
    }
  }
  break;

// NEU — validate() bekommt optionalen locale Parameter
static validate(
  fieldName: string,
  fieldType: AppSheetFieldType,
  value: any,
  rowIndex: number,
  locale?: string            // NEU
): void {
  // ...
  case 'Date':
    if (BaseTypeValidator.validateDateValue(fieldName, value, rowIndex)) {
      if (typeof value === 'string') {
        FormatValidator.validateDateFormat(fieldName, value, rowIndex, locale);
      }
    }
    break;

  case 'DateTime':
  case 'ChangeTimestamp':
    if (BaseTypeValidator.validateDateValue(fieldName, value, rowIndex)) {
      if (typeof value === 'string') {
        FormatValidator.validateDateTimeFormat(fieldName, value, rowIndex, locale);
      }
    }
    break;
}
```

### DynamicTable.validateRows(): Locale aufloesung

```typescript
private resolveLocale(): string | undefined {
  // Tabellen-Locale hat Vorrang vor Connection-Locale
  return this.definition.locale;
  // Hinweis: Connection-Locale wird beim Aufbau der TableDefinition
  // durch SchemaManager/DynamicTableFactory aufgeloest
}

private validateRows(rows: Partial<T>[], checkRequired = true): void {
  const locale = this.resolveLocale();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
      // ...
      AppSheetTypeValidator.validate(fieldName, fieldType, value, i, locale);
      // ...
    }
  }
}
```

### AppSheetClient.mergeProperties(): Locale automatisch senden

Der AppSheetClient hat Zugriff auf `connectionDef`, aber nicht auf die einzelne
TableDefinition des aktuellen Calls. Das Locale muss deshalb ueber die
`RequestProperties` der Operation mitgeschickt werden.

**Option A**: DynamicTable setzt `properties.Locale` bei jedem Client-Call

```typescript
// In DynamicTable.add()
const result = await this.client.add<T>({
  tableName: this.definition.tableName,
  rows: processedRows as T[],
  properties: { Locale: this.definition.locale }, // NEU
});
```

**Option B**: AppSheetClient liest Connection-Level Locale als Default

```typescript
// In AppSheetClient.mergeProperties()
private mergeProperties(operationProperties?: RequestProperties): RequestProperties {
  const properties: RequestProperties = {
    RunAsUserEmail: this.runAsUserEmail,
    Locale: this.connectionDef.locale,     // NEU: Connection-Default
  };
  if (operationProperties) {
    Object.assign(properties, operationProperties);  // Operation ueberschreibt
  }
  return properties;
}
```

**Empfehlung**: Beide Optionen kombinieren. Connection-Locale als Default im Client,
DynamicTable ueberschreibt mit Tabellen-Locale falls vorhanden.

### Locale-Aufloesung in SchemaManager/DynamicTableFactory

Die Kaskade (Tabelle > Connection > undefined) sollte beim Erstellen der DynamicTable
aufgeloest werden, sodass `TableDefinition.locale` immer den finalen Wert enthaelt:

```typescript
// In DynamicTableFactory oder SchemaManager
const effectiveLocale = tableDef.locale ?? connectionDef.locale ?? undefined;
const resolvedTableDef = { ...tableDef, locale: effectiveLocale };
return new DynamicTable(client, resolvedTableDef, unknownFieldPolicy);
```

Damit muss DynamicTable selbst keine Kaskade aufloesen — es sieht immer den
aufgeloesten Wert (oder undefined fuer "akzeptiere alles").

---

## Schema-Aenderungen

### TableDefinition

```typescript
export interface TableDefinition {
  tableName: string;
  keyField: string;
  locale?: string; // NEU — optional, z.B. "de-DE"
  fields: Record<string, FieldDefinition>;
}
```

### ConnectionDefinition

```typescript
export interface ConnectionDefinition {
  appId: string;
  applicationAccessKey: string;
  baseUrl?: string;
  timeout?: number;
  runAsUserEmail?: string;
  locale?: string; // NEU — Default fuer alle Tabellen dieser Connection
  tables: Record<string, TableDefinition>;
}
```

### YAML-Schema Beispiel

```yaml
connections:
  default:
    appId: ${APPSHEET_APP_ID}
    applicationAccessKey: ${APPSHEET_ACCESS_KEY}
    locale: de-DE
    tables:
      worklogs:
        tableName: extract_worklog
        keyField: worklog_id
        # locale nicht gesetzt → erbt de-DE von Connection
        fields:
          worklog_id: { type: Text, required: true }
          date: { type: Date }
          created_at: { type: DateTime }

      us_reports:
        tableName: extract_report
        keyField: report_id
        locale: en-US # Ueberschreibt Connection-Default
        fields:
          report_id: { type: Text, required: true }
          due_date: { type: Date }
```

---

## Aenderungsliste

| Datei                                           | Aenderung                                                                                                                 | Breaking?                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/types/schema.ts`                           | `locale?: string` in `TableDefinition` und `ConnectionDefinition`                                                         | Nein (optional)                   |
| `src/utils/validators/FormatValidator.ts`       | `validateDateFormat()` und `validateDateTimeFormat()` um `locale?` Parameter erweitern, `Intl.DateTimeFormat`-Validierung | Nein (neuer optionaler Parameter) |
| `src/utils/validators/AppSheetTypeValidator.ts` | `validate()` um `locale?` Parameter erweitern, an FormatValidator weiterreichen                                           | Nein (neuer optionaler Parameter) |
| `src/client/DynamicTable.ts`                    | `validateRows()` liest `this.definition.locale` und gibt es an Validator weiter                                           | Nein                              |
| `src/client/DynamicTable.ts`                    | `add()`, `update()` setzen `properties.Locale` am Client-Call                                                             | Nein                              |
| `src/client/AppSheetClient.ts`                  | `mergeProperties()` liest `connectionDef.locale` als Default                                                              | Nein                              |
| `src/client/DynamicTableFactory.ts`             | Locale-Kaskade aufloesen (table > connection > undefined)                                                                 | Nein                              |
| `src/utils/SchemaLoader.ts`                     | Locale-Feld beim Laden unterstuetzen (sollte automatisch gehen)                                                           | Nein                              |

---

## Test-Strategie

### Unit-Tests: FormatValidator (Locale-aware Date)

```typescript
describe('FormatValidator - Locale-aware Date validation', () => {
  describe('with locale en-US', () => {
    it('should accept MM/DD/YYYY', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0, 'en-US')).not.toThrow();
    });

    it('should accept single-digit month/day (3/11/2026)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '3/11/2026', 0, 'en-US')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'en-US')).not.toThrow();
    });

    it('should reject DD.MM.YYYY (de-DE format)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0, 'en-US')).toThrow(
        ValidationError
      );
    });

    it('should show locale example in error message', () => {
      expect(() => FormatValidator.validateDateFormat('d', 'invalid', 0, 'en-US')).toThrow(
        /expected.*\d{2}\/\d{2}\/\d{4}/
      );
    });
  });

  describe('with locale de-DE', () => {
    it('should accept DD.MM.YYYY', () => {
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0, 'de-DE')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'de-DE')).not.toThrow();
    });

    it('should reject MM/DD/YYYY (en-US format)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0, 'de-DE')).toThrow(
        ValidationError
      );
    });
  });

  describe('with locale ja-JP (auto-detected via Intl)', () => {
    it('should accept YYYY/MM/DD', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026/03/11', 0, 'ja-JP')).not.toThrow();
    });
  });

  describe('without locale (permissive)', () => {
    it('should accept any plausible date format', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0)).not.toThrow();
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0)).not.toThrow();
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0)).not.toThrow();
    });

    it('should reject obviously invalid strings', () => {
      expect(() => FormatValidator.validateDateFormat('d', 'not-a-date', 0)).toThrow(
        ValidationError
      );
    });
  });
});
```

### Unit-Tests: FormatValidator (Locale-aware DateTime)

```typescript
describe('FormatValidator - Locale-aware DateTime validation', () => {
  describe('with locale en-US', () => {
    it('should accept MM/DD/YYYY HH:mm:ss', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51:24', 0, 'en-US')
      ).not.toThrow();
    });

    it('should accept MM/DD/YYYY HH:mm (without seconds)', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51', 0, 'en-US')
      ).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026-03-11T21:51:24.000Z', 0, 'en-US')
      ).not.toThrow();
    });
  });

  describe('with locale de-DE', () => {
    it('should accept DD.MM.YYYY HH:mm:ss', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51:24', 0, 'de-DE')
      ).not.toThrow();
    });
  });

  describe('without locale (permissive)', () => {
    it('should accept any plausible datetime format', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51:24', 0)
      ).not.toThrow();
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51:24', 0)
      ).not.toThrow();
    });

    it('should reject obviously invalid strings', () => {
      expect(() => FormatValidator.validateDateTimeFormat('dt', 'not-a-datetime', 0)).toThrow(
        ValidationError
      );
    });
  });
});
```

### Unit-Tests: getLocaleDateFormat() Cache und Korrektheit

```typescript
describe('getLocaleDateFormat', () => {
  it('should detect en-US as MDY with / separator', () => {
    const fmt = getLocaleDateFormat('en-US');
    expect(fmt.partOrder).toEqual(['month', 'day', 'year']);
    expect(fmt.separator).toBe('/');
  });

  it('should detect de-DE as DMY with . separator', () => {
    const fmt = getLocaleDateFormat('de-DE');
    expect(fmt.partOrder).toEqual(['day', 'month', 'year']);
    expect(fmt.separator).toBe('.');
  });

  it('should detect ja-JP as YMD with / separator', () => {
    const fmt = getLocaleDateFormat('ja-JP');
    expect(fmt.partOrder).toEqual(['year', 'month', 'day']);
    expect(fmt.separator).toBe('/');
  });

  it('should cache results (same object returned)', () => {
    const fmt1 = getLocaleDateFormat('en-US');
    const fmt2 = getLocaleDateFormat('en-US');
    expect(fmt1).toBe(fmt2); // Exact same reference
  });

  it('should provide example date in locale format', () => {
    const fmt = getLocaleDateFormat('de-DE');
    expect(fmt.exampleDate).toBe('25.12.2026');
  });
});
```

### Integrations-Tests: DynamicTable mit Locale

```typescript
describe('DynamicTable with locale', () => {
  it('should accept locale date format in add()', async () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      locale: 'de-DE',
      fields: {
        id: { type: 'Text', required: true },
        date: { type: 'Date', required: true },
      },
    };
    const table = new DynamicTable(mockClient, tableDef);
    await expect(table.add([{ id: '1', date: '11.03.2026' }])).resolves.not.toThrow();
  });

  it('should reject wrong locale format in add()', async () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      locale: 'de-DE',
      fields: {
        id: { type: 'Text', required: true },
        date: { type: 'Date', required: true },
      },
    };
    const table = new DynamicTable(mockClient, tableDef);
    await expect(table.add([{ id: '1', date: '03/11/2026' }])).rejects.toThrow(ValidationError);
  });

  it('should send Locale in properties to client', async () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      locale: 'de-DE',
      fields: { id: { type: 'Text', required: true } },
    };
    const table = new DynamicTable(mockClient, tableDef);
    await table.add([{ id: '1' }]);
    expect(mockClient.add).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ Locale: 'de-DE' }),
      })
    );
  });

  it('should be permissive without locale (accept any format)', async () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      // kein locale gesetzt
      fields: {
        id: { type: 'Text', required: true },
        date: { type: 'Date', required: true },
      },
    };
    const table = new DynamicTable(mockClient, tableDef);
    // Beide Formate akzeptiert
    await expect(table.add([{ id: '1', date: '03/11/2026' }])).resolves.not.toThrow();
    await expect(table.add([{ id: '2', date: '11.03.2026' }])).resolves.not.toThrow();
  });
});
```

### Bestehende Tests anpassen

| Test                                                               | Aenderung                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `DynamicTable.test.ts` Zeile 353: `'11/20/2025'` rejected          | Entfernen oder zu "accepted without locale" aendern      |
| `DynamicTable.test.ts` Zeile 375: ISO 8601 accepted                | Bleibt — ISO ist immer gueltig                           |
| `DynamicTable.test.ts` Zeile 394: date-only rejected fuer DateTime | Bleibt — "2025-11-20" ist kein gueltiges DateTime-Format |

---

## Consumer-Impact: MCP-Server

Der MCP-Server (`service_portfolio_mcp`) kann nach dieser Aenderung:

1. **Locale aus Schema lesen**: `db.getTableDefinition('default', 'worklogs')?.locale`
2. **In Tool-Descriptions verwenden** — mit dynamischem Beispiel:
   ```typescript
   const locale = tableDef.locale ?? 'en-US';
   const fmt = getLocaleDateFormat(locale); // aus FormatValidator exportiert
   // → Tool description: "date (format: 25.12.2026)" — echtes Beispiel
   ```
3. **Keine eigene Format-Validierung noetig** — die Library macht das jetzt richtig
4. **Beliebige Locales** — der MCP-Server muss keine Locale-Liste pflegen

---

## Risikobewertung

| Risiko                                   | Einstufung  | Mitigation                                                                      |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| Breaking Change fuer bestehende Consumer | Kein Risiko | `locale` ist optional, Default-Verhalten aendert sich nur minimal               |
| Unbekannte/ungueltige Locales            | Niedrig     | `Intl.DateTimeFormat` wirft RangeError → catch → permissiver Modus als Fallback |
| Bestehende Tests brechen                 | Niedrig     | Nur 1-2 Tests betroffen (die aktuell falsches Verhalten testen)                 |
| Intl-Unterschiede zwischen Runtimes      | Niedrig     | Node.js hat seit v13+ vollstaendige ICU-Daten eingebaut                         |
| Percent-Validierung (0-1 vs 0-100)       | Offen       | Separates Issue — muss geprueft werden ob AppSheet 0-1 oder 0-100 erwartet      |

---

## Implementierungsplan

| Phase                            | Aufwand  | Beschreibung                                                                           |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| 1. Schema-Typen                  | 0.5h     | `locale?: string` in `TableDefinition` und `ConnectionDefinition`                      |
| 2. Intl-basierte Formaterkennung | 1.5h     | `getLocaleDateFormat()`, `DateFormatInfo`, Cache, Hilfs-Funktionen                     |
| 3. FormatValidator               | 1.5h     | `validateDateFormat()` und `validateDateTimeFormat()` mit `locale?` refactorn          |
| 4. AppSheetTypeValidator         | 0.5h     | `locale` Parameter durchreichen                                                        |
| 5. DynamicTable                  | 1h       | Locale aufloesung, an Validator und Client-Properties weiterreichen                    |
| 6. AppSheetClient                | 0.5h     | `mergeProperties()` mit Connection-Locale Default                                      |
| 7. DynamicTableFactory           | 0.5h     | Locale-Kaskade aufloesen                                                               |
| 8. Tests                         | 3h       | Unit (FormatValidator, getLocaleDateFormat) + Integration (DynamicTable) + Anpassungen |
| 9. Doku                          | 1h       | CLAUDE.md, Schema-Beispiele                                                            |
| **Gesamt**                       | **~10h** | **1-2 Tage**                                                                           |

---

## Offene Fragen

1. **Percent-Format**: AppSheet erwartet 0-100 oder 0.00-1.00?
   Aktuell validiert die Library 0.00-1.00. Muss geprueft werden.
   → Separates Issue falls falsch.

2. **SchemaInspector (`inspect` Command)**: Soll der CLI-Befehl das Locale
   automatisch erkennen (z.B. aus den Date-Werten im Sample)? Oder muss der
   User es manuell angeben?
   Vorschlag: `--locale` Flag beim `inspect` Command, Default `en-US`.

3. **Export von `getLocaleDateFormat()`**: Soll die Funktion exportiert werden,
   damit der MCP-Server sie fuer Tool-Descriptions nutzen kann?
   Vorschlag: Ja, als Teil des public API (`FormatValidator.getLocaleDateFormat()`
   oder als eigener Export).
