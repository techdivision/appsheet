# SOSO-435: Unknown Field Detection in DynamicTable.validateRows()

## Status: Konzeptphase

## Overview

`DynamicTable.validateRows()` validiert aktuell nur Felder die im Schema definiert sind. Felder im Row-Objekt die NICHT im Schema definiert sind, werden stillschweigend an die AppSheet API durchgereicht. Als Defense-in-Depth-Massnahme soll eine konfigurierbare Unknown-Field-Policy eingefuehrt werden.

## Referenzen

- Jira: [SOSO-435](https://techdivision.atlassian.net/browse/SOSO-435)
- GitHub Issue: [#11](https://github.com/techdivision/appsheet/issues/11)
- Verwandt: SOSO-434 (MockAppSheetClient.getKeyField Bug)
- Downstream Bugs verhindert: BUG-ASUP-001, BUG-ASUP-002 in `service_portfolio_mcp`

---

## Problem

### Aktuelles Verhalten (DynamicTable.ts)

```typescript
// DynamicTable.validateRows() (vereinfacht, Zeilen 62-81)
for (const field of schemaFields) {
  validateFieldType(row[field.name], field.type);
}
// ← Felder im Row die NICHT im Schema sind werden IGNORIERT
// ← Sie werden 1:1 an die AppSheet API durchgereicht
```

Wenn ein Consumer versehentlich ein Feld hinzufuegt das nicht in der AppSheet-Tabelle existiert (z.B. `id`, oder ein umbenanntes Feld wie `type` statt `types`), faengt `validateRows()` das nicht ab. Das ungueltige Feld wird an die API gesendet, die mit einem Fehler antwortet:

```
"Failed to get rows due to: 'id' is not a valid table column name.."
```

### Use Cases die erkannt werden sollen

| Use Case | Beispiel | Aktuell | Nach Fix |
|----------|----------|---------|----------|
| Veraltete Feldnamen nach Umbenennung | `type` statt `types` | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |
| Mock-Workaround-Felder | `id` fuer MockAppSheetClient | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |
| Tippfehler in Feldnamen | `desciption` statt `description` | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |

---

## Loesung: Konfigurierbare Unknown-Field-Policy

### Design-Entscheidung

Die Policy wird als Option auf `DynamicTable`-Ebene konfiguriert. Das Schema enthaelt bereits alle Felddefinitionen — die Information ist vorhanden.

### Policy-Optionen

| Policy | Verhalten | Default? | Use Case |
|--------|-----------|----------|----------|
| `ignore` | Aktuelles Verhalten — unbekannte Felder durchreichen | **Ja** (Rueckwaertskompatibilitaet) | Legacy-Code, Migration |
| `warn` | Warnung loggen, Felder durchreichen | Nein | Debugging, schrittweise Migration |
| `strip` | Unbekannte Felder entfernen vor API-Aufruf | Nein | Sicherer Produktionsbetrieb |
| `error` | Error werfen bei unbekannten Feldern | Nein | Strict Mode, CI/CD |

### API-Design

#### Option A: Konfiguration auf DynamicTable-Ebene (bevorzugt)

```typescript
// Ueber SchemaManager.table() Options
const table = schemaManager.table<Solution>('default', 'solution', email, {
  unknownFields: 'strip' // 'ignore' | 'warn' | 'strip' | 'error'
});
```

#### Option B: Globale SchemaManager-Konfiguration

```typescript
// Globaler Default fuer alle Tables
const schemaManager = new SchemaManager(factory, schema, {
  unknownFieldPolicy: 'warn'
});
```

#### Empfehlung: Beide Optionen kombiniert

- **SchemaManager** setzt den globalen Default (z.B. `'warn'`)
- **DynamicTable** kann pro Tabelle ueberschreiben (z.B. `'strip'`)
- Ohne Konfiguration: `'ignore'` (100% rueckwaertskompatibel)

### Type-Definitionen

```typescript
// Neue Types in src/types/config.ts oder src/types/schema.ts

export type UnknownFieldPolicy = 'ignore' | 'warn' | 'strip' | 'error';

export interface DynamicTableOptions {
  /** Policy fuer Felder die nicht im Schema definiert sind. Default: 'ignore' */
  unknownFields?: UnknownFieldPolicy;
}

export interface SchemaManagerOptions {
  /** Globaler Default fuer Unknown-Field-Policy. Default: 'ignore' */
  unknownFieldPolicy?: UnknownFieldPolicy;
}
```

### Implementierung in DynamicTable

```typescript
// DynamicTable.validateRows() — erweitert

private detectUnknownFields(row: Record<string, unknown>): string[] {
  const schemaFieldNames = new Set(
    Object.keys(this.tableDefinition.fields)
  );
  return Object.keys(row).filter(key => !schemaFieldNames.has(key));
}

private applyUnknownFieldPolicy(
  rows: Record<string, unknown>[],
  policy: UnknownFieldPolicy
): Record<string, unknown>[] {
  return rows.map(row => {
    const unknownFields = this.detectUnknownFields(row);

    if (unknownFields.length === 0) return row;

    switch (policy) {
      case 'ignore':
        return row;

      case 'warn':
        console.warn(
          `[DynamicTable] Unknown fields in table '${this.tableName}': ` +
          `${unknownFields.join(', ')}. ` +
          `These fields are not defined in the schema and will be sent to the API as-is.`
        );
        return row;

      case 'strip':
        const cleaned = { ...row };
        for (const field of unknownFields) {
          delete cleaned[field];
        }
        return cleaned;

      case 'error':
        throw new AppSheetValidationError(
          `Unknown fields in table '${this.tableName}': ${unknownFields.join(', ')}. ` +
          `These fields are not defined in the schema. ` +
          `Remove them or update the schema to include them.`
        );
    }
  });
}
```

### Integration in bestehende Methoden

```typescript
// DynamicTable.add() und DynamicTable.update()

async add(rows: T[]): Promise<AddResponse<T>> {
  const policy = this.options?.unknownFields ?? this.globalPolicy ?? 'ignore';
  const processedRows = this.applyUnknownFieldPolicy(rows as any[], policy);
  this.validateRows(processedRows, 'add');
  return this.client.add({ tableName: this.tableName, rows: processedRows });
}

async update(rows: T[]): Promise<UpdateResponse<T>> {
  const policy = this.options?.unknownFields ?? this.globalPolicy ?? 'ignore';
  const processedRows = this.applyUnknownFieldPolicy(rows as any[], policy);
  this.validateRows(processedRows, 'update');
  return this.client.update({ tableName: this.tableName, rows: processedRows });
}
```

### DI-Kompatibilitaet

Die Aenderung ist vollstaendig DI-kompatibel:

- `DynamicTableFactoryInterface.create()` erhaelt einen optionalen `options`-Parameter
- Bestehende Aufrufe ohne Options funktionieren unveraendert (Default: `'ignore'`)
- Consumer-Projekte koennen die Policy ueber DI konfigurieren

```typescript
// Consumer DI-Registration (z.B. service_portfolio_mcp)
container.register(TOKENS.DynamicTableFactory, {
  useFactory: (c) => {
    const clientFactory = c.resolve<AppSheetClientFactoryInterface>(TOKENS.AppSheetClientFactory);
    return new DynamicTableFactory(clientFactory, schema, {
      unknownFieldPolicy: 'warn' // Globaler Default
    });
  },
});
```

---

## Vollstaendige Aenderungsliste

### Neue/Geaenderte Types (2)

| Datei | Aenderung |
|-------|-----------|
| `src/types/config.ts` | `UnknownFieldPolicy` Type, `DynamicTableOptions`, `SchemaManagerOptions` |
| `src/types/errors.ts` | `AppSheetValidationError` erweitern (falls noetig) |

### Zu aendernde Dateien (4)

| Datei | Aenderung |
|-------|-----------|
| `src/client/DynamicTable.ts` | `detectUnknownFields()`, `applyUnknownFieldPolicy()`, Integration in `add()`/`update()` |
| `src/client/DynamicTableFactory.ts` | Options-Durchreichung, globaler Default |
| `src/utils/SchemaManager.ts` | `SchemaManagerOptions` entgegennehmen, an Factory weiterreichen |
| `src/types/index.ts` | Neue Types exportieren |

### Neue Test-Dateien (1)

| Datei | Inhalt |
|-------|--------|
| `tests/client/DynamicTable.unknownFields.test.ts` | Dedizierte Tests fuer Unknown-Field-Detection |

### Unveraenderte Dateien

| Datei | Grund |
|-------|-------|
| `src/client/AppSheetClient.ts` | Empfaengt bereits bereinigte Rows |
| `src/client/MockAppSheetClient.ts` | Empfaengt bereits bereinigte Rows |
| `src/types/factories.ts` | Interface bleibt kompatibel (optionaler Parameter) |

---

## Test-Strategie

### Policy-Tests

```typescript
describe('DynamicTable Unknown Field Detection', () => {
  describe('policy: ignore (default)', () => {
    it('should pass unknown fields through to API', async () => {
      const table = createTable({ unknownFields: 'ignore' });
      await table.add([{ solution_id: '1', unknown_field: 'value' }]);
      // unknown_field should be in the API call
    });
  });

  describe('policy: warn', () => {
    it('should log warning but pass fields through', async () => {
      const table = createTable({ unknownFields: 'warn' });
      const spy = jest.spyOn(console, 'warn');
      await table.add([{ solution_id: '1', unknown_field: 'value' }]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('unknown_field'));
    });
  });

  describe('policy: strip', () => {
    it('should remove unknown fields before API call', async () => {
      const table = createTable({ unknownFields: 'strip' });
      await table.add([{ solution_id: '1', unknown_field: 'value' }]);
      // unknown_field should NOT be in the API call
    });
  });

  describe('policy: error', () => {
    it('should throw for unknown fields', async () => {
      const table = createTable({ unknownFields: 'error' });
      await expect(
        table.add([{ solution_id: '1', unknown_field: 'value' }])
      ).rejects.toThrow('Unknown fields');
    });
  });

  describe('edge cases', () => {
    it('should not flag known fields as unknown', async () => {
      const table = createTable({ unknownFields: 'error' });
      await expect(
        table.add([{ solution_id: '1', name: 'Test' }])
      ).resolves.toBeDefined();
    });

    it('should handle empty rows', async () => {
      const table = createTable({ unknownFields: 'strip' });
      await expect(table.add([{}])).resolves.toBeDefined();
    });
  });
});
```

---

## Risikobewertung

| Risiko | Einstufung | Mitigation |
|--------|------------|------------|
| Breaking Change fuer bestehende Consumer | Kein Risiko | Default ist `'ignore'` (aktuelles Verhalten) |
| Performance-Impact bei grossen Batches | Sehr niedrig | Set-Lookup ist O(1) pro Feld |
| False Positives (Felder die AppSheet akzeptiert aber nicht im Schema) | Niedrig | `'ignore'` als Escape-Hatch |
| Logging-Overhead bei `'warn'` | Niedrig | Nur bei tatsaechlichen Unknown Fields |

---

## Implementierungsplan

| Phase | Aufwand | Beschreibung |
|-------|---------|--------------|
| 1. Types & Interfaces | 2h | `UnknownFieldPolicy`, Options-Interfaces |
| 2. Detection-Logik | 4h | `detectUnknownFields()`, `applyUnknownFieldPolicy()` |
| 3. Integration | 3h | Einbau in `add()`, `update()`, Factory-Durchreichung |
| 4. Tests | 4h | Policy-Tests, Edge Cases, DI-Integration |
| 5. Dokumentation | 2h | CLAUDE.md, README, Migration Guide |
| **Gesamt** | **~15h** | **2-3 Tage** |

---

## Follow-Up

- **SOSO-434:** MockAppSheetClient.getKeyField() Fix — verwandter Bug der durch diese Erweiterung fruehzeitig erkannt worden waere
- **Downstream Cleanup:** `service_portfolio_mcp` — kuenstliches `id`-Feld und Workarounds entfernen nach Bugfix
- **Logging-Integration:** In Consumer-Projekten mit AOP-Logging koennte die `'warn'`-Policy durch einen Custom Logger ersetzt werden (via DI)
