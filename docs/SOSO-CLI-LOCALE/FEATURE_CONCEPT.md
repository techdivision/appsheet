# CLI: --locale Option fuer inspect und add-table

## Status: Konzept

| Feld       | Wert                                                            |
| ---------- | --------------------------------------------------------------- |
| GitHub     | #19 (Enhancement)                                               |
| Version    | v3.3.0 (zusammen mit SOSO-439 + SOSO-440)                       |
| Abhaengig  | SOSO-439 (Locale-aware Validation), SOSO-440 (Write Conversion) |
| Betrifft   | SchemaInspector, CLI commands (inspect, add-table)              |
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

## Loesung

### Neue CLI-Option: `--locale <locale>`

```bash
# Inspect mit Locale
npx appsheet inspect \
  --app-id $ID \
  --access-key $KEY \
  --tables extract_worklog,extract_user \
  --locale de-DE

# Add-table mit Locale
npx appsheet add-table default extract_project --locale de-DE
```

### Generierte Ausgabe mit --locale

```yaml
connections:
  default:
    appId: ${APPSHEET_APP_ID}
    applicationAccessKey: ${APPSHEET_ACCESS_KEY}
    locale: de-DE # ← NEU: Connection-Level
    tables:
      worklogs:
        tableName: extract_worklog
        keyField: id
        locale: de-DE # ← NEU: Table-Level
        fields:
          date:
            type: Date
            required: false
```

### Design-Entscheidung: Beide Ebenen setzen

Wenn `--locale` angegeben wird, wird es auf **beiden** Ebenen gesetzt:

- **Connection-Level**: Als Default fuer neue Tabellen
- **Table-Level**: Explizit an jeder generierten Tabelle

**Begruendung**: Explizit > implizit. Wenn ein Consumer spaeter eine Tabelle mit anderem
Locale braucht, kann er den Table-Level-Wert einfach aendern. Der Connection-Level dient
als Dokumentation des Standard-Locale.

### Ohne --locale: Keine Aenderung

Wenn `--locale` nicht angegeben wird, bleibt das Verhalten identisch zu heute.
Kein `locale`-Feld wird gesetzt. Backward-kompatibel.

---

## Betroffene Dateien

### `src/cli/commands.ts`

**inspect-Command** (Zeile 49-118):

```typescript
// NEU: --locale Option
.option('--locale <locale>', 'BCP 47 locale tag (e.g., de-DE, en-US)')

// In action handler:
const connection = await inspector.generateSchema(
  options.connectionName,
  tableNames,
  options.locale    // NEU: durchreichen
);

// Connection-Level locale setzen
if (options.locale) {
  connection.locale = options.locale;
}
```

**add-table-Command** (Zeile 146-187):

```typescript
// NEU: --locale Option
.option('--locale <locale>', 'BCP 47 locale tag (e.g., de-DE, en-US)')

// In action handler — beim Erstellen der TableDefinition:
schema.connections[connection].tables[schemaName] = {
  tableName: inspection.tableName,
  keyField: inspection.keyField,
  locale: options.locale,    // NEU: kann undefined sein
  fields: inspection.fields,
};
```

### `src/cli/SchemaInspector.ts`

**generateSchema()** (Zeile 271-297):

```typescript
async generateSchema(
  _connectionName: string,
  tableNames: string[],
  locale?: string            // NEU: optionaler Parameter
): Promise<ConnectionDefinition> {
  const tables: Record<string, TableDefinition> = {};

  for (const tableName of tableNames) {
    console.log(`Inspecting table: ${tableName}...`);
    const inspection = await this.inspectTable(tableName);

    tables[this.toSchemaName(tableName)] = {
      tableName: inspection.tableName,
      keyField: inspection.keyField,
      locale,                  // NEU: undefined wenn nicht angegeben
      fields: inspection.fields,
    };

    if (inspection.warning) {
      console.warn(`  Warning: ${inspection.warning}`);
    }
  }

  return {
    appId: '${APPSHEET_APP_ID}',
    applicationAccessKey: '${APPSHEET_ACCESS_KEY}',
    locale,                    // NEU: Connection-Level
    tables,
  };
}
```

### Output-Hinweis aktualisieren

In `commands.ts` Zeile 111-114:

```typescript
console.log('\nPlease review and update:');
console.log('  - Key fields may need manual adjustment');
console.log('  - Field types are inferred and may need refinement');
console.log('  - Add required, enum, and description properties as needed');
if (!options.locale) {
  console.log('  - Consider adding locale (e.g., --locale de-DE) for date validation');
}
```

---

## Test-Strategie

### Unit-Tests: SchemaInspector.generateSchema()

```typescript
describe('generateSchema with locale', () => {
  it('should set locale on each table when provided', async () => {
    const result = await inspector.generateSchema('default', ['table1'], 'de-DE');
    expect(result.locale).toBe('de-DE');
    expect(result.tables['table1s'].locale).toBe('de-DE');
  });

  it('should not set locale when not provided', async () => {
    const result = await inspector.generateSchema('default', ['table1']);
    expect(result.locale).toBeUndefined();
    expect(result.tables['table1s'].locale).toBeUndefined();
  });
});
```

### E2E: CLI Output

```typescript
describe('inspect command with --locale', () => {
  it('should include locale in generated YAML', () => {
    // Parse generated YAML output and verify locale fields
  });
});
```

---

## Implementierungsplan

| Phase              | Aufwand | Beschreibung                         |
| ------------------ | ------- | ------------------------------------ |
| 1. CLI Option      | 0.5h    | `--locale` bei inspect und add-table |
| 2. SchemaInspector | 0.5h    | `generateSchema()` locale-Parameter  |
| 3. Output-Hinweis  | 0.25h   | Hinweis wenn kein locale angegeben   |
| 4. Tests           | 1h      | Unit + CLI Tests                     |
| **Gesamt**         | **~2h** |                                      |

---

## Risikobewertung

| Risiko                     | Einstufung  | Mitigation                                     |
| -------------------------- | ----------- | ---------------------------------------------- |
| Breaking Change            | Kein Risiko | Neuer optionaler Parameter, Default undefined  |
| Ungueltige Locale-Werte    | Niedrig     | Keine Validierung noetig — Intl.DateTimeFormat |
|                            |             | wirft ohnehin bei ungueltigen Locales          |
| YAML mit undefined-Feldern | Niedrig     | YAML-Serializer ignoriert undefined-Werte      |
