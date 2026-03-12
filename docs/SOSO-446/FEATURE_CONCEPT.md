# CLI: Automatische Locale-Erkennung bei inspect und add-table

## Status: Konzept

| Feld       | Wert                                                            |
| ---------- | --------------------------------------------------------------- |
| JIRA       | SOSO-446                                                        |
| GitHub     | #19 (Enhancement)                                               |
| Version    | v3.3.0 (zusammen mit SOSO-439 + SOSO-440)                       |
| Abhaengig  | SOSO-439 (Locale-aware Validation), SOSO-440 (Write Conversion) |
| Betrifft   | SchemaInspector, CLI commands (inspect, add-table), Types       |
| Prioritaet | Niedrig — Workaround: manuell `locale` im YAML setzen           |

---

## Problemanalyse

### Ausgangslage

Die CLI-Commands `inspect` und `add-table` generieren Schema-YAML ohne `locale`-Feld:

```yaml
# Aktuelle Ausgabe von: npx appsheet inspect --tables extract_worklog
connections:
  default:
    appId: ${APPSHEET_APP_ID}
    applicationAccessKey: ${APPSHEET_ACCESS_KEY}
    tables:
      worklogs:
        tableName: extract_worklog
        keyField: id
        # ← kein locale!
        fields:
          date:
            type: Date
            required: false
```

### Konsequenz

Ohne `locale` im Schema:

- **SOSO-439**: Validation laeuft im permissiven Modus (akzeptiert jedes plausible Datumsformat)
- **SOSO-440**: `LocaleWriteConversionPolicy` agiert als NoOp (kein Locale = keine Konvertierung)

Der Consumer muss nach jedem `inspect` manuell `locale` an jede Tabelle oder Connection haengen.

---

## Loesung: Automatische Locale-Erkennung

### Kernidee

Die CLI holt bei `inspect` und `add-table` bereits bis zu 100 Sample-Rows per API.
Date/DateTime-Felder in diesen Rows sind im Locale-Format des AppSheet-Apps formatiert
(z.B. `"12.03.2026"` fuer de-DE, `"03/12/2026"` fuer en-US).

Aus diesen Werten kann der `SchemaInspector` das Locale **automatisch erkennen** —
kein CLI-Parameter noetig.

### Gewuenschte Ausgabe

```yaml
# Automatisch generiert — Locale erkannt aus API-Daten
connections:
  default:
    appId: ${APPSHEET_APP_ID}
    applicationAccessKey: ${APPSHEET_ACCESS_KEY}
    locale: de-DE # ← automatisch erkannt
    tables:
      worklogs:
        tableName: extract_worklog
        keyField: id
        locale: de-DE # ← automatisch erkannt
        fields:
          date:
            type: Date
            required: false
```

---

## Erkennungsalgorithmus

### Uebersicht

```
Sample-Rows holen
  → Date/DateTime-Felder identifizieren (bereits in inferType())
  → Datumswerte sammeln (nicht-ISO, nicht-leer)
  → Separator erkennen ("." oder "/")
  → Part-Reihenfolge bestimmen (DMY, MDY, YMD)
  → Mapping auf repraesentatives Locale
```

### Schritt 1: Datumswerte sammeln

Aus den Sample-Rows werden alle Werte gesammelt, die als Date oder DateTime
erkannt wurden. ISO-Werte (`YYYY-MM-DD`, `YYYY-MM-DDT...`) werden ignoriert,
da sie kein Locale-Signal enthalten.

```typescript
// Pseudo-Code
const dateValues = sampleRows
  .flatMap((row) => dateFieldNames.map((f) => row[f]))
  .filter((v) => typeof v === 'string')
  .filter((v) => !ISO_DATE.test(v) && !ISO_DATETIME.test(v));
```

Fuer DateTime-Werte (z.B. `"12.03.2026 14:30:00"`) wird nur der Date-Teil
vor dem Leerzeichen analysiert.

### Schritt 2: Separator erkennen

Der Separator wird aus dem ersten nicht-ISO Datumswert extrahiert:

| Datumswert   | Separator |
| ------------ | --------- |
| `12.03.2026` | `.`       |
| `03/12/2026` | `/`       |
| `2026/03/12` | `/`       |

```typescript
// Separator ist das erste nicht-numerische Zeichen im Date-Teil
const separator = datePart.match(/[^0-9]/)?.[0];
```

### Schritt 3: Part-Reihenfolge bestimmen

Die drei Teile eines Datums (Tag, Monat, Jahr) werden anhand ihrer Werte identifiziert:

**Eindeutige Faelle:**

- 4-stelliger Part → Jahr
- Part > 12 (und nicht Jahr) → muss Tag sein (Monat max. 12)

**Algorithmus:**

```
1. Teile den Date-String am Separator → [part1, part2, part3]
2. Finde das Jahr (4-stelliger Part):
   - Position 0 → YMD (z.B. ja-JP: "2026/03/12")
   - Position 2 → DMY oder MDY
3. Bei Jahr an Position 2 — DMY vs MDY bestimmen:
   - Ueber ALLE Sample-Datumswerte iterieren
   - Wenn je ein erster Part > 12 → DMY (erster Part ist Tag)
   - Wenn je ein zweiter Part > 12 → MDY (zweiter Part ist Tag)
   - Wenn KEIN Part > 12 → mehrdeutig
```

**Beispiele:**

| Werte im Dataset                       | Erkennung                  |
| -------------------------------------- | -------------------------- |
| `25.03.2026`, `12.06.2026`             | DMY (25 > 12)              |
| `03/25/2026`, `06/12/2026`             | MDY (25 > 12 an Pos 2)     |
| `2026/03/12`, `2026/12/25`             | YMD (Jahr an Pos 0)        |
| `03/06/2026`, `01/12/2026` (alle ≤ 12) | Mehrdeutig → Default en-US |

### Schritt 4: Mapping auf repraesentatives Locale

| Part-Order | Separator | Locale  | Beispiel     |
| ---------- | --------- | ------- | ------------ |
| DMY        | `.`       | `de-DE` | `12.03.2026` |
| DMY        | `/`       | `en-GB` | `12/03/2026` |
| MDY        | `/`       | `en-US` | `03/12/2026` |
| YMD        | `/`       | `ja-JP` | `2026/03/12` |
| Mehrdeutig | `/`       | `en-US` | Default      |
| Mehrdeutig | `.`       | `de-DE` | Default      |

**Begruendung fuer Defaults:**

- `/` + mehrdeutig → `en-US`: Haeufigste AppSheet-Deployments sind US-basiert
- `.` + mehrdeutig → `de-DE`: Punkt als Separator ist fast ausschliesslich DACH-Raum

### Schritt 5: Ergebnis

- Locale wird in `TableInspectionResult.locale` gespeichert
- `generateSchema()` setzt es auf Connection- und Table-Ebene
- Bei mehrdeutiger Erkennung: Warning im CLI-Output

---

## Sonderfaelle

### Keine Datumswerte vorhanden

Wenn eine Tabelle keine Date/DateTime/ChangeTimestamp-Felder hat oder alle
Datumswerte leer/null/ISO sind, kann kein Locale erkannt werden.

→ `locale` bleibt `undefined` fuer diese Tabelle.

### Leere Tabelle

Wenn die Tabelle keine Rows hat, gibt es keine Daten zur Analyse.

→ `locale` bleibt `undefined` (wie bisher auch fuer Feldtypen).

### Alle Tabellen im selben App teilen ein Locale

AppSheet setzt das Locale auf App-Ebene. Alle Tabellen einer Connection
geben Daten im selben Format zurueck.

→ Erkennung bei der ersten Tabelle mit Date-Feldern reicht.
Wird aber trotzdem pro Tabelle durchgefuehrt (Robustheit).
`generateSchema()` setzt das Connection-Level Locale auf das
am haeufigsten erkannte Locale aller Tabellen.

### DateTime-Werte

DateTime-Werte wie `"12.03.2026 14:30:00"` werden vor der Analyse
am Leerzeichen gesplittet. Nur der Date-Teil wird fuer die Erkennung
verwendet.

---

## Betroffene Dateien

### `src/types/schema.ts`

**TableInspectionResult erweitern:**

```typescript
export interface TableInspectionResult {
  tableName: string;
  keyField: string;
  fields: Record<string, FieldDefinition>;
  locale?: string; // NEU: automatisch erkanntes Locale
  warning?: string;
}
```

### `src/cli/SchemaInspector.ts`

**Neue Methode: `detectLocale()`**

```typescript
/** Locale-Mapping: partOrder + separator → representative locale */
private static readonly LOCALE_MAP: Record<string, string> = {
  'day,month,year:.': 'de-DE',
  'day,month,year:/': 'en-GB',
  'month,day,year:/': 'en-US',
  'year,month,day:/': 'ja-JP',
};

/** Default locales for ambiguous cases, keyed by separator */
private static readonly DEFAULT_LOCALE: Record<string, string> = {
  '/': 'en-US',
  '.': 'de-DE',
};

/**
 * Detect locale from date values in sample rows.
 *
 * Analyzes Date/DateTime field values to determine the locale
 * of the AppSheet app by examining separator and part order.
 *
 * @param rows - Sample rows from AppSheet API
 * @param fields - Already-inferred field definitions
 * @returns Detected locale or undefined if detection not possible
 */
private detectLocale(
  rows: Record<string, any>[],
  fields: Record<string, FieldDefinition>
): { locale?: string; ambiguous: boolean } {
  // 1. Collect date field names
  const dateFieldNames = Object.entries(fields)
    .filter(([, def]) => ['Date', 'DateTime', 'ChangeTimestamp'].includes(def.type))
    .map(([name]) => name);

  if (dateFieldNames.length === 0) {
    return { locale: undefined, ambiguous: false };
  }

  // 2. Collect non-ISO date strings
  const dateStrings: string[] = [];
  for (const row of rows) {
    for (const fieldName of dateFieldNames) {
      const value = row[fieldName];
      if (typeof value !== 'string') continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) continue; // Skip ISO

      // For DateTime, extract date part only
      const spaceIdx = value.indexOf(' ');
      const datePart = spaceIdx > 0 ? value.substring(0, spaceIdx) : value;
      dateStrings.push(datePart);
    }
  }

  if (dateStrings.length === 0) {
    return { locale: undefined, ambiguous: false };
  }

  // 3. Detect separator from first value
  const separator = dateStrings[0].match(/[^0-9]/)?.[0];
  if (!separator) {
    return { locale: undefined, ambiguous: false };
  }

  // 4. Determine part order
  const parts = dateStrings[0].split(separator);
  if (parts.length !== 3) {
    return { locale: undefined, ambiguous: false };
  }

  // Year position (4-digit part)
  const yearPos = parts.findIndex(p => p.length === 4);
  if (yearPos === 0) {
    // YMD
    const key = `year,month,day:${separator}`;
    const locale = SchemaInspector.LOCALE_MAP[key];
    return { locale, ambiguous: false };
  }

  if (yearPos !== 2) {
    return { locale: undefined, ambiguous: false };
  }

  // Year at position 2 → DMY or MDY
  // Check all date values for disambiguation
  let foundFirstPartGt12 = false;
  let foundSecondPartGt12 = false;

  for (const dateStr of dateStrings) {
    const p = dateStr.split(separator);
    if (p.length !== 3) continue;
    const first = parseInt(p[0], 10);
    const second = parseInt(p[1], 10);
    if (first > 12) foundFirstPartGt12 = true;
    if (second > 12) foundSecondPartGt12 = true;
  }

  if (foundFirstPartGt12 && !foundSecondPartGt12) {
    // First part is day → DMY
    const key = `day,month,year:${separator}`;
    const locale = SchemaInspector.LOCALE_MAP[key];
    return { locale, ambiguous: false };
  }

  if (foundSecondPartGt12 && !foundFirstPartGt12) {
    // Second part is day → MDY
    const key = `month,day,year:${separator}`;
    const locale = SchemaInspector.LOCALE_MAP[key];
    return { locale, ambiguous: false };
  }

  // Ambiguous: no part > 12, or both > 12 (shouldn't happen)
  const defaultLocale = SchemaInspector.DEFAULT_LOCALE[separator] || 'en-US';
  return { locale: defaultLocale, ambiguous: true };
}
```

**Integration in `inspectTable()`:**

```typescript
async inspectTable(tableName: string): Promise<TableInspectionResult> {
  // ... (bestehende Logik: rows holen, fields inferieren) ...

  // NEU: Locale aus Date-Feldern erkennen
  const { locale, ambiguous } = this.detectLocale(sampleRows, fields);

  let warning = inspection.warning;
  if (ambiguous) {
    const msg = `Locale detection ambiguous, defaulting to "${locale}". Please verify.`;
    warning = warning ? `${warning}; ${msg}` : msg;
  }

  return {
    tableName,
    keyField: this.guessKeyField(sampleRows[0]),
    fields,
    locale,        // NEU
    warning,
  };
}
```

**Integration in `generateSchema()`:**

```typescript
async generateSchema(
  _connectionName: string,
  tableNames: string[]
): Promise<ConnectionDefinition> {
  const tables: Record<string, TableDefinition> = {};
  const detectedLocales: string[] = [];

  for (const tableName of tableNames) {
    console.log(`Inspecting table: ${tableName}...`);
    const inspection = await this.inspectTable(tableName);

    const tableDef: TableDefinition = {
      tableName: inspection.tableName,
      keyField: inspection.keyField,
      fields: inspection.fields,
    };

    // NEU: Locale setzen wenn erkannt
    if (inspection.locale) {
      tableDef.locale = inspection.locale;
      detectedLocales.push(inspection.locale);
    }

    tables[this.toSchemaName(tableName)] = tableDef;

    if (inspection.warning) {
      console.warn(`  Warning: ${inspection.warning}`);
    }
  }

  // NEU: Connection-Level Locale = haeufigstes erkanntes Locale
  const connectionLocale = this.mostFrequent(detectedLocales);

  const connectionDef: ConnectionDefinition = {
    appId: '${APPSHEET_APP_ID}',
    applicationAccessKey: '${APPSHEET_ACCESS_KEY}',
    tables,
  };

  if (connectionLocale) {
    connectionDef.locale = connectionLocale;
  }

  return connectionDef;
}

/** Returns the most frequent string in an array, or undefined if empty */
private mostFrequent(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}
```

### `src/cli/commands.ts`

**Output-Hinweis aktualisieren** (kein `--locale` Parameter):

```typescript
// In inspect action handler:
console.log('\nPlease review and update:');
console.log('  - Key fields may need manual adjustment');
console.log('  - Field types are inferred and may need refinement');
console.log('  - Add required, enum, and description properties as needed');
// NEU: Hinweis nur wenn kein Locale erkannt wurde
if (!connection.locale) {
  console.log('  - No locale detected. Consider adding locale manually for date validation.');
}
```

**add-table-Command:**

```typescript
// In add-table action handler:
schema.connections[connection].tables[schemaName] = {
  tableName: inspection.tableName,
  keyField: inspection.keyField,
  locale: inspection.locale, // NEU: automatisch erkannt, kann undefined sein
  fields: inspection.fields,
};
```

---

## Design-Entscheidung: Beide Ebenen setzen

Wenn ein Locale erkannt wird, wird es auf **beiden** Ebenen gesetzt:

- **Connection-Level**: Haeufigstes Locale aller Tabellen, als Default
- **Table-Level**: Pro Tabelle individuell erkannt

**Begruendung**: Explizit > implizit. Auch wenn alle Tabellen in einem AppSheet-App
dasselbe Locale haben, ist es fuer den Consumer hilfreich, das Locale an jeder Tabelle
explizit zu sehen.

---

## Test-Strategie

### Unit-Tests: `detectLocale()`

```typescript
describe('detectLocale', () => {
  describe('de-DE detection (DMY with dot)', () => {
    it('should detect de-DE from DD.MM.YYYY dates', () => {
      const rows = [
        { date: '25.03.2026' }, // 25 > 12 → first part is day → DMY
        { date: '12.06.2026' },
      ];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('de-DE');
      expect(result.ambiguous).toBe(false);
    });
  });

  describe('en-US detection (MDY with slash)', () => {
    it('should detect en-US from MM/DD/YYYY dates', () => {
      const rows = [
        { date: '03/25/2026' }, // 25 > 12 → second part is day → MDY
        { date: '06/12/2026' },
      ];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('en-US');
      expect(result.ambiguous).toBe(false);
    });
  });

  describe('en-GB detection (DMY with slash)', () => {
    it('should detect en-GB from DD/MM/YYYY dates', () => {
      const rows = [
        { date: '25/03/2026' }, // 25 > 12 → first part is day → DMY
        { date: '12/06/2026' },
      ];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('en-GB');
      expect(result.ambiguous).toBe(false);
    });
  });

  describe('ja-JP detection (YMD with slash)', () => {
    it('should detect ja-JP from YYYY/MM/DD dates', () => {
      const rows = [{ date: '2026/03/12' }, { date: '2026/12/25' }];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('ja-JP');
      expect(result.ambiguous).toBe(false);
    });
  });

  describe('ambiguous cases', () => {
    it('should default to en-US when slash separator is ambiguous', () => {
      const rows = [
        { date: '03/06/2026' }, // Both parts ≤ 12
        { date: '01/12/2026' },
      ];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('en-US');
      expect(result.ambiguous).toBe(true);
    });

    it('should default to de-DE when dot separator is ambiguous', () => {
      const rows = [
        { date: '03.06.2026' }, // Both parts ≤ 12
        { date: '01.12.2026' },
      ];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('de-DE');
      expect(result.ambiguous).toBe(true);
    });
  });

  describe('no detection possible', () => {
    it('should return undefined when no date fields exist', () => {
      const rows = [{ name: 'Test' }];
      const fields = { name: { type: 'Text' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBeUndefined();
    });

    it('should return undefined when all dates are ISO', () => {
      const rows = [{ date: '2026-03-12' }];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBeUndefined();
    });

    it('should return undefined when date fields are empty', () => {
      const rows = [{ date: null }, { date: undefined }];
      const fields = { date: { type: 'Date' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBeUndefined();
    });
  });

  describe('DateTime values', () => {
    it('should detect locale from DateTime values (date part only)', () => {
      const rows = [{ created: '25.03.2026 14:30:00' }];
      const fields = { created: { type: 'DateTime' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('de-DE');
      expect(result.ambiguous).toBe(false);
    });
  });

  describe('ChangeTimestamp values', () => {
    it('should detect locale from ChangeTimestamp values', () => {
      const rows = [{ modified: '03/25/2026 09:00:00' }];
      const fields = { modified: { type: 'ChangeTimestamp' } };
      const result = inspector['detectLocale'](rows, fields);
      expect(result.locale).toBe('en-US');
      expect(result.ambiguous).toBe(false);
    });
  });
});
```

### Integration-Tests: `inspectTable()` mit Locale

```typescript
describe('inspectTable with locale detection', () => {
  it('should include detected locale in result', async () => {
    // Mock client returns rows with de-DE formatted dates
    mockClient.find.mockResolvedValue({
      rows: [
        { id: '1', date: '25.03.2026', name: 'Test' },
        { id: '2', date: '12.06.2026', name: 'Other' },
      ],
    });
    const result = await inspector.inspectTable('extract_worklog');
    expect(result.locale).toBe('de-DE');
  });

  it('should add warning for ambiguous locale', async () => {
    mockClient.find.mockResolvedValue({
      rows: [{ id: '1', date: '03/06/2026' }],
    });
    const result = await inspector.inspectTable('extract_worklog');
    expect(result.locale).toBe('en-US');
    expect(result.warning).toContain('ambiguous');
  });
});
```

### Integration-Tests: `generateSchema()` mit Locale

```typescript
describe('generateSchema with auto-detected locale', () => {
  it('should set locale on connection and table level', async () => {
    // Mock: table has de-DE dates
    const result = await inspector.generateSchema('default', ['extract_worklog']);
    expect(result.locale).toBe('de-DE');
    expect(result.tables['worklogs'].locale).toBe('de-DE');
  });

  it('should not set locale when no date fields exist', async () => {
    // Mock: table has only Text fields
    const result = await inspector.generateSchema('default', ['extract_config']);
    expect(result.locale).toBeUndefined();
    expect(result.tables['configs'].locale).toBeUndefined();
  });
});
```

---

## Implementierungsplan

| Phase                             | Aufwand | Beschreibung                                          |
| --------------------------------- | ------- | ----------------------------------------------------- |
| 1. TableInspectionResult          | 0.25h   | `locale?: string` hinzufuegen                         |
| 2. `detectLocale()`               | 1.5h    | Erkennungsalgorithmus implementieren                  |
| 3. Integration `inspectTable()`   | 0.5h    | `detectLocale()` aufrufen, Warning bei Mehrdeutigkeit |
| 4. Integration `generateSchema()` | 0.5h    | Locale auf Connection + Table Level setzen            |
| 5. `add-table` Command            | 0.25h   | `inspection.locale` durchreichen                      |
| 6. Output-Hinweis                 | 0.25h   | Hinweis wenn kein Locale erkannt                      |
| 7. Tests                          | 1.5h    | Unit + Integration Tests                              |
| **Gesamt**                        | **~5h** |                                                       |

---

## Risikobewertung

| Risiko                                     | Einstufung   | Mitigation                                     |
| ------------------------------------------ | ------------ | ---------------------------------------------- |
| Breaking Change                            | Kein Risiko  | Neues optionales Feld in TableInspectionResult |
| Falsche Locale-Erkennung (mehrdeutig)      | Niedrig      | Default en-US/de-DE, Warning im Output         |
| Tabelle ohne Date-Felder                   | Kein Risiko  | locale bleibt undefined                        |
| Leere Tabelle                              | Kein Risiko  | Wie bisher, kein Locale erkennbar              |
| Nur ISO-Daten in der Tabelle               | Niedrig      | Kein Locale erkennbar, bleibt undefined        |
| YAML mit undefined-Feldern                 | Kein Risiko  | YAML-Serializer ignoriert undefined-Werte      |
| Unbekannter Separator (weder "." noch "/") | Sehr niedrig | Locale bleibt undefined, kein Crash            |
