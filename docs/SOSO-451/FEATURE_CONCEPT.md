# SchemaManager: Optionaler tableFactory-Parameter

## Status: Konzept

| Feld       | Wert                                                        |
| ---------- | ----------------------------------------------------------- |
| JIRA       | SOSO-451                                                    |
| GitHub     | #21 (Feature Request)                                       |
| Version    | v3.5.0 (Minor — neuer optionaler Parameter)                 |
| Abhaengig  | Keine                                                       |
| Betrifft   | SchemaManager (`src/utils/SchemaManager.ts`)                |
| Prioritaet | Mittel — Workaround: unsicherer Property-Override existiert |

---

## Problemanalyse

### Ausgangslage

Der `SchemaManager`-Konstruktor (Zeile 64-78 in `src/utils/SchemaManager.ts`) erstellt
seine `DynamicTableFactory` intern mit nur 2 Parametern:

```typescript
constructor(
  clientFactory: AppSheetClientFactoryInterface,
  private readonly schema: SchemaConfig
) {
  // ...
  this.tableFactory = new DynamicTableFactory(clientFactory, schema);
}
```

### Konsequenz

Consumer koennen keine vorkonfigurierte `DynamicTableFactory` mit Custom Policies
uebergeben. Im `service_portfolio_mcp`-Projekt wird eine Factory mit
`LocaleWriteConversionPolicy` fuer korrekte Datums-/Zahlenformatierung benoetigt.

Aktueller Workaround (OCP-Verletzung):

```typescript
(schemaManager as unknown as { tableFactory: DynamicTableFactory }).tableFactory = tableFactory;
```

Dieser Workaround:

- Bricht bei internem Refactoring (private Property-Name aendert sich)
- Umgeht TypeScript-Sicherheit (`unknown`-Cast)
- Ist fuer Consumer nicht dokumentiert und nicht auffindbar

---

## Loesung: Optionaler 3. Konstruktor-Parameter

### Kernidee

Der `SchemaManager`-Konstruktor erhaelt einen optionalen 3. Parameter
`tableFactory?: DynamicTableFactoryInterface`. Wenn uebergeben, wird die
injizierte Factory verwendet. Wenn nicht, wird wie bisher intern eine
`DynamicTableFactory` erstellt.

### Vorher (v3.4.0)

```typescript
const clientFactory = new AppSheetClientFactory();
const schema = SchemaLoader.fromYaml('./schema.yaml');

// Standard — keine Custom Policies moeglich
const db = new SchemaManager(clientFactory, schema);
```

### Nachher (v3.5.0)

```typescript
const clientFactory = new AppSheetClientFactory();
const schema = SchemaLoader.fromYaml('./schema.yaml');

// Option A: Ohne Factory (unveraendertes Verhalten)
const db = new SchemaManager(clientFactory, schema);

// Option B: Mit Custom Factory (z.B. fuer Locale-Konvertierung)
const tableFactory = new DynamicTableFactory(
  clientFactory,
  schema,
  undefined, // unknownFieldPolicy
  new LocaleWriteConversionPolicy() // writeConversionPolicy
);
const dbWithLocale = new SchemaManager(clientFactory, schema, tableFactory);
```

---

## Betroffene Dateien

### `src/utils/SchemaManager.ts`

**Konstruktor-Signatur erweitern:**

```typescript
constructor(
  clientFactory: AppSheetClientFactoryInterface,
  private readonly schema: SchemaConfig,
  tableFactory?: DynamicTableFactoryInterface  // NEU: optional
) {
  // Validate schema
  const validation = SchemaLoader.validate(schema);
  if (!validation.valid) {
    throw new ValidationError(
      `Invalid schema: ${validation.errors.join(', ')}`,
      validation.errors
    );
  }

  // Use injected factory or create default
  this.tableFactory = tableFactory ?? new DynamicTableFactory(clientFactory, schema);
}
```

**Aenderung:** 1 Zeile Signatur, 1 Zeile Body (Fallback mit Nullish Coalescing).

### TSDoc aktualisieren

````typescript
/**
 * Creates a new SchemaManager.
 *
 * @param clientFactory - Factory to create AppSheetClient instances
 * @param schema - Schema configuration containing connection and table definitions
 * @param tableFactory - Optional pre-configured DynamicTableFactory.
 *   When provided, this factory is used instead of creating a new one internally.
 *   Use this to inject factories with custom policies (e.g., WriteConversionPolicy).
 * @throws {ValidationError} If the schema is invalid
 *
 * @example
 * ```typescript
 * // Without custom factory (default behavior)
 * const db = new SchemaManager(clientFactory, schema);
 *
 * // With custom factory (e.g., for locale-aware write conversion)
 * const tableFactory = new DynamicTableFactory(clientFactory, schema, undefined, writePolicy);
 * const db = new SchemaManager(clientFactory, schema, tableFactory);
 * ```
 */
````

---

## Abwaertskompatibilitaet

| Aspekt                | Bewertung     | Begruendung                                            |
| --------------------- | ------------- | ------------------------------------------------------ |
| Bestehende Aufrufe    | Kompatibel    | Parameter ist optional, Default-Verhalten unveraendert |
| API-Kontrakt          | Kompatibel    | Additive Aenderung (neuer optionaler Parameter)        |
| Semver-Einstufung     | Minor (3.5.0) | Feature-Addition ohne Breaking Change                  |
| TypeScript-Interfaces | Kompatibel    | Keine Interface-Aenderung noetig                       |

**Kein Consumer muss Code aendern.** Bestehende Aufrufe mit 2 Parametern
funktionieren identisch.

---

## Test-Strategie

### Unit-Tests: Konstruktor-Pfade

```typescript
describe('SchemaManager constructor', () => {
  describe('without tableFactory (default behavior)', () => {
    it('should create internal DynamicTableFactory', () => {
      const db = new SchemaManager(clientFactory, validSchema);
      // Verify table() works (implicitly tests internal factory creation)
      const table = db.table('default', 'users', 'user@example.com');
      expect(table).toBeInstanceOf(DynamicTable);
    });
  });

  describe('with injected tableFactory', () => {
    it('should use the provided factory instead of creating a new one', () => {
      const mockTableFactory: DynamicTableFactoryInterface = {
        create: jest.fn().mockReturnValue(mockDynamicTable),
      };

      const db = new SchemaManager(clientFactory, validSchema, mockTableFactory);
      db.table('default', 'users', 'user@example.com');

      expect(mockTableFactory.create).toHaveBeenCalledWith('default', 'users', 'user@example.com');
    });

    it('should not create a DynamicTableFactory when one is provided', () => {
      const spy = jest.spyOn(DynamicTableFactory.prototype, 'create');
      const customFactory: DynamicTableFactoryInterface = {
        create: jest.fn().mockReturnValue(mockDynamicTable),
      };

      new SchemaManager(clientFactory, validSchema, customFactory);

      // Verify the internal factory's create() is never called
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('schema validation still applies', () => {
    it('should throw ValidationError for invalid schema even with custom factory', () => {
      const customFactory: DynamicTableFactoryInterface = {
        create: jest.fn(),
      };

      expect(() => {
        new SchemaManager(clientFactory, invalidSchema, customFactory);
      }).toThrow(ValidationError);
    });
  });
});
```

### Integration-Test: Custom Policy durchreichen

```typescript
describe('SchemaManager with custom WriteConversionPolicy', () => {
  it('should use locale-aware conversion when custom factory is provided', async () => {
    const writePolicy = new LocaleWriteConversionPolicy('de-DE');
    const tableFactory = new DynamicTableFactory(mockClientFactory, schema, undefined, writePolicy);

    const db = new SchemaManager(mockClientFactory, schema, tableFactory);
    const table = db.table('default', 'worklogs', 'user@example.com');

    // Verify that write operations use the locale policy
    await table.add([{ date: '2026-03-12' }]);
    // Assert that the date was converted to de-DE format before API call
  });
});
```

---

## Implementierungsplan

| Phase           | Aufwand   | Beschreibung                                      |
| --------------- | --------- | ------------------------------------------------- |
| 1. Konstruktor  | 0.25h     | Optionalen Parameter + Fallback-Logik hinzufuegen |
| 2. TSDoc        | 0.25h     | Dokumentation aktualisieren                       |
| 3. Unit-Tests   | 0.5h      | Tests fuer beide Pfade + Validation               |
| 4. Version Bump | 0.1h      | `package.json` auf 3.5.0                          |
| 5. AGENTS.md    | 0.25h     | Dokumentation in AGENTS.md aktualisieren          |
| **Gesamt**      | **~1.5h** |                                                   |

---

## Risikobewertung

| Risiko                          | Einstufung  | Mitigation                                       |
| ------------------------------- | ----------- | ------------------------------------------------ |
| Breaking Change                 | Kein Risiko | Neuer optionaler Parameter, Default unveraendert |
| Schema-Validation wird umgangen | Kein Risiko | Validation laeuft vor Factory-Zuweisung          |
| Inkonsistente Factory/Schema    | Niedrig     | Consumer-Verantwortung, dokumentiert in TSDoc    |
