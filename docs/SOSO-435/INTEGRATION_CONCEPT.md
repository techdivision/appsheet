# SOSO-435: Unknown Field Detection in DynamicTable via Strategy-Pattern

## Status: Konzeptphase

## Overview

`DynamicTable.validateRows()` validiert aktuell nur Felder die im Schema definiert sind. Felder im Row-Objekt die NICHT im Schema definiert sind, werden stillschweigend an die AppSheet API durchgereicht. Als Defense-in-Depth-Massnahme soll eine injizierbare `UnknownFieldPolicyInterface` eingefuehrt werden — analog zum bestehenden `SelectorBuilderInterface`-Pattern.

## Referenzen

- Jira: [SOSO-435](https://techdivision.atlassian.net/browse/SOSO-435)
- GitHub Issue: [#11](https://github.com/techdivision/appsheet/issues/11)
- Verwandt: SOSO-434 (MockAppSheetClient.getKeyField Bug)
- Downstream Bugs verhindert: BUG-ASUP-001, BUG-ASUP-002 in `service_portfolio_mcp`

---

## Problem

### Aktuelles Verhalten (DynamicTable.ts)

```typescript
// DynamicTable.validateRows() (vereinfacht, Zeilen 288-322)
for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
  // Nur bekannte Felder werden validiert
  AppSheetTypeValidator.validate(fieldName, fieldType, value, i);
}
// ← Felder im Row die NICHT im Schema sind werden IGNORIERT
// ← Sie werden 1:1 an die AppSheet API durchgereicht
```

Wenn ein Consumer versehentlich ein Feld hinzufuegt das nicht in der AppSheet-Tabelle existiert (z.B. `id`, oder ein umbenanntes Feld wie `type` statt `types`), faengt `validateRows()` das nicht ab. Das ungueltige Feld wird an die API gesendet, die mit einem Fehler antwortet:

```
"Failed to get rows due to: 'id' is not a valid table column name.."
```

### Betroffene Methoden

| Methode        | Nimmt Row-Objekte?                | Validierung aktuell         | Unknown Fields? |
| -------------- | --------------------------------- | --------------------------- | --------------- |
| `add(rows)`    | Ja — vollstaendige Rows           | `validateRows(rows)`        | ❌ Ignoriert    |
| `update(rows)` | Ja — partielle Rows mit Key       | `validateRows(rows, false)` | ❌ Ignoriert    |
| `delete(keys)` | Ja — Rows mit mindestens Key-Feld | Keine Validierung           | ❌ Ignoriert    |

**Wichtig:** `delete()` ist ebenfalls betroffen. Consumer uebergeben oft vollstaendige Row-Objekte
(z.B. `{ solution_id: '123', id: '123' }`), die 1:1 an die API durchgereicht werden.
Dies war einer der BUG-ASUP-002-Faelle im `service_portfolio_mcp`-Projekt.

### Use Cases die erkannt werden sollen

| Use Case                             | Beispiel                         | Aktuell               | Nach Fix               |
| ------------------------------------ | -------------------------------- | --------------------- | ---------------------- |
| Veraltete Feldnamen nach Umbenennung | `type` statt `types`             | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |
| Mock-Workaround-Felder               | `id` fuer MockAppSheetClient     | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |
| Tippfehler in Feldnamen              | `desciption` statt `description` | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |
| Ueberflussige Felder bei Delete      | `{ solution_id: '1', id: '1' }`  | ❌ Stiller API-Fehler | ✅ Fruehzeitig erkannt |

---

## Design: Strategy-Pattern mit DI-Injection

### Design-Entscheidung

Analog zum bestehenden `SelectorBuilderInterface`-Pattern wird ein `UnknownFieldPolicyInterface`
eingefuehrt. Die Library liefert drei Implementierungen mit, der Consumer kann eigene injizieren.

**Warum Strategy-Pattern statt String-Config (`'ignore' | 'strip' | 'error'`)?**

1. **Konsistenz** — Gleiches DI-Pattern wie `SelectorBuilderInterface`
2. **Library bleibt stumm** — Kein `console.warn` im Library-Code (die Library hat keine einzige Runtime-Logging-Stelle)
3. **Consumer-Kontrolle** — Eigene Implementierung mit eigenem Logger/AOP-Dekoratoren moeglich
4. **Open/Closed** — Neue Policies ohne Library-Aenderung

### Vergleich mit SelectorBuilder-Pattern

| Aspekt            | SelectorBuilder (bestehend)               | UnknownFieldPolicy (neu)                               |
| ----------------- | ----------------------------------------- | ------------------------------------------------------ |
| Interface         | `types/selector.ts`                       | `types/policies.ts`                                    |
| Implementierungen | `utils/SelectorBuilder.ts` (1 Klasse)     | `utils/policies/*.ts` (3 Klassen)                      |
| Factory-Injection | `AppSheetClientFactory(selectorBuilder?)` | `DynamicTableFactory(clientFactory, schema, policy?)`  |
| Default           | `new SelectorBuilder()`                   | `new StripUnknownFieldPolicy()`                        |
| Weiterreichung    | Factory → `AppSheetClient` Constructor    | Factory → `DynamicTable` Constructor                   |
| Aufrufstelle      | `find()` ruft `ensureFunction()`          | `add()`, `update()`, `delete()` rufen `policy.apply()` |

### Policy-Implementierungen

| Klasse                     | Verhalten                                        | Default? | Use Case                    |
| -------------------------- | ------------------------------------------------ | -------- | --------------------------- |
| `IgnoreUnknownFieldPolicy` | Rows unveraendert durchreichen                   | Nein     | Legacy-Code, Migration      |
| `StripUnknownFieldPolicy`  | Unbekannte Felder entfernen vor API-Aufruf       | **Ja**   | Sicherer Produktionsbetrieb |
| `ErrorUnknownFieldPolicy`  | `ValidationError` werfen bei unbekannten Feldern | Nein     | Strict Mode, CI/CD          |

**Default ist `StripUnknownFieldPolicy`** — sicherer als Ignore, und konsistent mit der Library-Philosophie:
Die Library handelt (strip) oder wirft (error), aber loggt nicht.

---

## Interface-Definition

### `UnknownFieldPolicyInterface`

```typescript
// src/types/policies.ts

/**
 * Interface for handling fields in row objects that are not defined in the table schema.
 *
 * Implementations decide what happens when a row contains fields that are not
 * in the schema: ignore them, strip them, throw an error, or custom behavior.
 *
 * Analog to SelectorBuilderInterface — injectable via DynamicTableFactory constructor.
 *
 * @category Types
 */
export interface UnknownFieldPolicyInterface {
  /**
   * Process rows and handle any fields not defined in the table schema.
   *
   * @param tableName - The AppSheet table name (for error messages)
   * @param rows - The row objects to process
   * @param knownFields - Array of field names defined in the table schema
   * @returns Processed rows (may be modified, filtered, or unchanged)
   * @throws {ValidationError} If the policy rejects unknown fields (e.g. ErrorUnknownFieldPolicy)
   */
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[];
}
```

---

## Implementierungen

### `IgnoreUnknownFieldPolicy`

```typescript
// src/utils/policies/IgnoreUnknownFieldPolicy.ts

export class IgnoreUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    return rows;
  }
}
```

### `StripUnknownFieldPolicy` (Default)

```typescript
// src/utils/policies/StripUnknownFieldPolicy.ts

export class StripUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    const knownSet = new Set(knownFields);
    return rows.map((row) => {
      const cleaned = {} as Partial<T>;
      for (const [key, value] of Object.entries(row)) {
        if (knownSet.has(key)) {
          (cleaned as any)[key] = value;
        }
      }
      return cleaned;
    });
  }
}
```

### `ErrorUnknownFieldPolicy`

```typescript
// src/utils/policies/ErrorUnknownFieldPolicy.ts

import { ValidationError } from '../../types';

export class ErrorUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    const knownSet = new Set(knownFields);
    for (let i = 0; i < rows.length; i++) {
      const unknownFields = Object.keys(rows[i]).filter((key) => !knownSet.has(key));
      if (unknownFields.length > 0) {
        throw new ValidationError(
          `Unknown fields in table "${tableName}" (row ${i}): ${unknownFields.join(', ')}. ` +
            `These fields are not defined in the schema. ` +
            `Remove them or update the schema to include them.`,
          { tableName, unknownFields, rowIndex: i }
        );
      }
    }
    return rows;
  }
}
```

---

## Integration in DynamicTable

### Constructor-Erweiterung

```typescript
// src/client/DynamicTable.ts

export class DynamicTable<T extends Record<string, any> = Record<string, any>> {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;

  constructor(
    private client: AppSheetClientInterface,
    private definition: TableDefinition,
    unknownFieldPolicy?: UnknownFieldPolicyInterface  // optionaler 3. Parameter
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
  }
```

### Integration in alle drei Methoden

```typescript
// DynamicTable.add()
async add(rows: Partial<T>[]): Promise<T[]> {
  const knownFields = Object.keys(this.definition.fields);
  const processedRows = this.unknownFieldPolicy.apply(
    this.definition.tableName, rows, knownFields
  );
  this.validateRows(processedRows);
  const result = await this.client.add<T>({
    tableName: this.definition.tableName,
    rows: processedRows as T[],
  });
  return result.rows;
}

// DynamicTable.update()
async update(rows: Partial<T>[]): Promise<T[]> {
  const knownFields = Object.keys(this.definition.fields);
  const processedRows = this.unknownFieldPolicy.apply(
    this.definition.tableName, rows, knownFields
  );
  this.validateRows(processedRows, false);
  const result = await this.client.update<T>({
    tableName: this.definition.tableName,
    rows: processedRows as T[],
  });
  return result.rows;
}

// DynamicTable.delete()
async delete(keys: Partial<T>[]): Promise<boolean> {
  const knownFields = Object.keys(this.definition.fields);
  const processedKeys = this.unknownFieldPolicy.apply(
    this.definition.tableName, keys, knownFields
  );
  await this.client.delete({
    tableName: this.definition.tableName,
    rows: processedKeys,
  });
  return true;
}
```

---

## Injection-Kette

### DynamicTableFactory

```typescript
// src/client/DynamicTableFactory.ts

export class DynamicTableFactory implements DynamicTableFactoryInterface {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;

  constructor(
    private readonly clientFactory: AppSheetClientFactoryInterface,
    private readonly schema: SchemaConfig,
    unknownFieldPolicy?: UnknownFieldPolicyInterface // optionaler 3. Parameter
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
  }

  create<T extends Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    const connectionDef = this.schema.connections[connectionName];
    // ... (bestehende Lookup-Logik unveraendert)
    const client = this.clientFactory.create(connectionDef, runAsUserEmail);
    const tableDef = client.getTable(tableName);
    return new DynamicTable<T>(client, tableDef, this.unknownFieldPolicy);
  }
}
```

### SchemaManager (unveraendert)

`SchemaManager` erstellt intern eine `DynamicTableFactory`. Die Policy-Injection erfolgt
analog zum bestehenden Pattern: Der Consumer injiziert die Policy ueber die `DynamicTableFactory`,
die er dem `SchemaManager` uebergibt — oder `SchemaManager` instanziiert die Factory mit dem Default.

### Vollstaendige Injection-Kette

```
Consumer (z.B. service_portfolio_mcp)
  |
  +---> DynamicTableFactory(clientFactory, schema, new LoggingStripPolicy())
          |                                         ^^^^^^^^^^^^^^^^^^^^^^^^
          |                                         Consumer-eigene Implementierung
          |
          +---> DynamicTable(client, tableDef, policy)
                  |
                  +---> add()/update()/delete()
                          |
                          +---> policy.apply(tableName, rows, knownFields)
                                  |
                                  +---> bereinigte Rows → API-Call
```

---

## DI-Kompatibilitaet

### Keine Breaking Changes

- `DynamicTableFactoryInterface.create()` bleibt **unveraendert** (kein neuer Parameter)
- `DynamicTable` Constructor erhaelt optionalen 3. Parameter (rueckwaertskompatibel)
- Default-Verhalten aendert sich: `ignore` → `strip` (sicherer Default)

**Hinweis:** Der Default-Wechsel von `ignore` zu `strip` ist technisch ein Verhaltensaenderung.
In der Praxis ist `strip` jedoch das sicherere Verhalten und verhindert API-Fehler.
Consumer die das alte Verhalten benoetigen, koennen explizit `IgnoreUnknownFieldPolicy` injizieren.

### Consumer-Beispiel: service_portfolio_mcp mit AOP

```typescript
// Eigene Policy mit AOP-Logging (service_portfolio_mcp)
@injectable()
class LoggingStripPolicy implements UnknownFieldPolicyInterface {
  constructor(private readonly inner: StripUnknownFieldPolicy = new StripUnknownFieldPolicy()) {}

  @LogExecution()
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    // AOP-Decorator loggt automatisch — kein manuelles console.warn noetig
    return this.inner.apply(tableName, rows, knownFields);
  }
}

// DI-Registration
container.register(TOKENS.DynamicTableFactory, {
  useFactory: (c) =>
    new DynamicTableFactory(
      c.resolve<AppSheetClientFactoryInterface>(TOKENS.AppSheetClientFactory),
      schema,
      new LoggingStripPolicy()
    ),
});
```

---

## Vollstaendige Aenderungsliste

### Neue Dateien (5)

| Datei                                            | Inhalt                                   |
| ------------------------------------------------ | ---------------------------------------- |
| `src/types/policies.ts`                          | `UnknownFieldPolicyInterface`            |
| `src/utils/policies/IgnoreUnknownFieldPolicy.ts` | Rows unveraendert durchreichen           |
| `src/utils/policies/StripUnknownFieldPolicy.ts`  | Unbekannte Felder entfernen (Default)    |
| `src/utils/policies/ErrorUnknownFieldPolicy.ts`  | ValidationError bei unbekannten Feldern  |
| `src/utils/policies/index.ts`                    | Re-export aller Policy-Implementierungen |

### Zu aendernde Dateien (4)

| Datei                               | Aenderung                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/client/DynamicTable.ts`        | 3. Constructor-Param `unknownFieldPolicy?`, `policy.apply()` in `add()`, `update()`, `delete()` |
| `src/client/DynamicTableFactory.ts` | 3. Constructor-Param `unknownFieldPolicy?`, Durchreichung an DynamicTable                       |
| `src/types/index.ts`                | `export * from './policies'`                                                                    |
| `src/utils/index.ts`                | `export * from './policies'`                                                                    |

### Neue Test-Dateien (2)

| Datei                                               | Inhalt                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `tests/utils/policies/UnknownFieldPolicies.test.ts` | Unit-Tests fuer alle 3 Policy-Implementierungen                         |
| `tests/client/DynamicTable.unknownFields.test.ts`   | Integrations-Tests: Policy-Anwendung in `add()`, `update()`, `delete()` |

### Unveraenderte Dateien

| Datei                              | Grund                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| `src/client/AppSheetClient.ts`     | Empfaengt bereits bereinigte Rows                           |
| `src/client/MockAppSheetClient.ts` | Empfaengt bereits bereinigte Rows                           |
| `src/types/factories.ts`           | `DynamicTableFactoryInterface.create()` bleibt unveraendert |

---

## Test-Strategie

### Unit-Tests: Policy-Implementierungen

```typescript
describe('IgnoreUnknownFieldPolicy', () => {
  const policy = new IgnoreUnknownFieldPolicy();

  it('should return rows unchanged', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
    expect(result[0]).toHaveProperty('unknown_field');
  });
});

describe('StripUnknownFieldPolicy', () => {
  const policy = new StripUnknownFieldPolicy();

  it('should remove unknown fields', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result[0]).toEqual({ solution_id: '1', name: 'Test' });
    expect(result[0]).not.toHaveProperty('unknown_field');
  });

  it('should return rows unchanged if no unknown fields', () => {
    const rows = [{ solution_id: '1', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
  });

  it('should handle empty rows', () => {
    const result = policy.apply('solution', [{}], ['solution_id']);
    expect(result).toEqual([{}]);
  });

  it('should handle multiple rows', () => {
    const rows = [
      { solution_id: '1', bad: 'x' },
      { solution_id: '2', bad: 'y', name: 'Ok' },
    ];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result[0]).toEqual({ solution_id: '1' });
    expect(result[1]).toEqual({ solution_id: '2', name: 'Ok' });
  });
});

describe('ErrorUnknownFieldPolicy', () => {
  const policy = new ErrorUnknownFieldPolicy();

  it('should throw ValidationError for unknown fields', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value' }];
    expect(() => policy.apply('solution', rows, ['solution_id', 'name'])).toThrow(ValidationError);
  });

  it('should include field names and row index in error', () => {
    const rows = [{ solution_id: '1' }, { solution_id: '2', bad: 'x' }];
    expect(() => policy.apply('solution', rows, ['solution_id', 'name'])).toThrow(/row 1/);
  });

  it('should return rows unchanged if no unknown fields', () => {
    const rows = [{ solution_id: '1', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
  });
});
```

### Integrations-Tests: DynamicTable mit Policy

```typescript
describe('DynamicTable Unknown Field Handling', () => {
  describe('default behavior (StripUnknownFieldPolicy)', () => {
    it('should strip unknown fields in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef); // Default: Strip
      await table.add([{ solution_id: '1', unknown: 'value' }]);
      // Verify: mockClient.add() was called WITHOUT 'unknown' field
    });

    it('should strip unknown fields in update()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.update([{ solution_id: '1', unknown: 'value' }]);
      // Verify: mockClient.update() was called WITHOUT 'unknown' field
    });

    it('should strip unknown fields in delete()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.delete([{ solution_id: '1', id: '1' }]);
      // Verify: mockClient.delete() was called WITHOUT 'id' field
    });
  });

  describe('with injected IgnoreUnknownFieldPolicy', () => {
    it('should pass unknown fields through in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef, new IgnoreUnknownFieldPolicy());
      await table.add([{ solution_id: '1', unknown: 'value' }]);
      // Verify: mockClient.add() was called WITH 'unknown' field
    });
  });

  describe('with injected ErrorUnknownFieldPolicy', () => {
    it('should throw in add() for unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());
      await expect(table.add([{ solution_id: '1', unknown: 'value' }])).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw in delete() for unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());
      await expect(table.delete([{ solution_id: '1', id: '1' }])).rejects.toThrow(ValidationError);
    });
  });

  describe('with custom policy (DI)', () => {
    it('should accept any UnknownFieldPolicyInterface implementation', async () => {
      const customPolicy: UnknownFieldPolicyInterface = {
        apply: jest.fn((tableName, rows, knownFields) => rows),
      };
      const table = new DynamicTable(mockClient, tableDef, customPolicy);
      await table.add([{ solution_id: '1', extra: 'value' }]);
      expect(customPolicy.apply).toHaveBeenCalledWith(
        'solution',
        expect.any(Array),
        expect.arrayContaining(['solution_id'])
      );
    });
  });
});
```

---

## Risikobewertung

| Risiko                                                                | Einstufung   | Mitigation                                                   |
| --------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| Default-Wechsel (ignore → strip)                                      | Niedrig      | Strip ist sicherer; Consumer kann Ignore explizit injizieren |
| Performance-Impact bei grossen Batches                                | Sehr niedrig | Set-Lookup ist O(1) pro Feld                                 |
| False Positives (Felder die AppSheet akzeptiert aber nicht im Schema) | Niedrig      | `IgnoreUnknownFieldPolicy` als Escape-Hatch                  |
| Breaking Change fuer DynamicTable-Constructor                         | Kein Risiko  | 3. Parameter ist optional                                    |

---

## Implementierungsplan

| Phase                       | Aufwand  | Beschreibung                                             |
| --------------------------- | -------- | -------------------------------------------------------- |
| 1. Interface                | 1h       | `UnknownFieldPolicyInterface` in `src/types/policies.ts` |
| 2. Implementierungen        | 3h       | 3 Policy-Klassen in `src/utils/policies/`                |
| 3. DynamicTable-Integration | 3h       | Constructor, `add()`, `update()`, `delete()`             |
| 4. Factory-Integration      | 1h       | `DynamicTableFactory` Constructor + Durchreichung        |
| 5. Exports                  | 0.5h     | `types/index.ts`, `utils/index.ts`                       |
| 6. Unit-Tests Policies      | 2h       | Tests fuer alle 3 Implementierungen                      |
| 7. Integrations-Tests       | 3h       | DynamicTable mit allen Policies + DI                     |
| 8. Dokumentation            | 1.5h     | CLAUDE.md, Beispiele                                     |
| **Gesamt**                  | **~15h** | **2-3 Tage**                                             |

---

## Follow-Up

- **SOSO-434:** MockAppSheetClient.getKeyField() Fix — verwandter Bug der durch StripUnknownFieldPolicy fruehzeitig entschaerft worden waere
- **Downstream Cleanup:** `service_portfolio_mcp` — kuenstliches `id`-Feld und Workarounds entfernen nach Bugfix
- **Consumer-Integration:** `service_portfolio_mcp` kann eigene Policy mit AOP-Logging (`@LogExecution`) injizieren — die Library selbst bleibt stumm
