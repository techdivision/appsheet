# SOSO-365: AppSheet API Selector-Fix + Default-URL Korrektur

## Status: IMPLEMENTIERT

## Overview

Zwei Bugs in der `@techdivision/appsheet` Library:

1. **Selector ohne `Filter()`-Wrapper** -- Die `find()`-Methode setzte einfache Boolean-Expressions direkt als `Properties.Selector`, obwohl die AppSheet API laut Spezifikation Funktionsausdruecke wie `Filter(tableName, expression)` erwartet.
2. **Veralteter Default-Endpoint** -- Die Library verwendete `https://api.appsheet.com/api/v2` als Default, dieser Endpoint ist laut offizieller Doku deprecated.

Zusaetzlich wurde das `AppSheetFilterEscape`-Utility aus dem `service_portfolio_mcp`-Projekt in die Library integriert, da Value-Escaping gegen Injection-Angriffe ein generisches AppSheet-Problem ist.

## Referenzen

- Jira: [SOSO-365](https://techdivision.atlassian.net/browse/SOSO-365)
- AppSheet API Doku: [Read records from a table](https://support.google.com/appsheet/answer/10105770)
- AppSheet API Doku: [Invoke the API](https://support.google.com/appsheet/answer/10105398)
- AppSheet API Doku: [Data Residency / Regionale Endpoints](https://support.google.com/appsheet/answer/13788479)

---

## Fix 1: SelectorBuilder-Klasse mit Interface

### Problem

`AppSheetClient.find()` setzte den Selector direkt ohne `Filter()`-Wrapper:

```typescript
// VORHER (Bug):
if (options.selector) {
  properties.Selector = options.selector;
}
```

Laut AppSheet API-Spezifikation muss der `Selector` eine AppSheet-Funktion sein:

```
Filter(People, [Age] >= 21)
Select(People[_ComputedKey], [Status] = "Active", true)
OrderBy(Filter(People, [Age] >= 21), [LastName], true)
Top(OrderBy(Filter(People, true), [LastName], true), 10)
```

### Design-Entscheidung

Statt einzelner Utility-Funktionen wurde eine saubere Klasse mit Interface implementiert, die sowohl API-Compliance (Selector-Wrapping) als auch Security (Value-Escaping) abdeckt.

**Wrapping nur im `AppSheetClient`** (realer HTTP-Client):

- Die `FindOptions.selector`-API bleibt unveraendert -- Consumer uebergeben weiterhin einfache Expressions
- `MockAppSheetClient` braucht keine Aenderung -- parst rohe Expression in-memory
- `DynamicTable` braucht keine Aenderung -- delegiert an Client
- **Kein Breaking Change**

### Loesung: `SelectorBuilderInterface` + `SelectorBuilder`

#### Interface (`src/types/selector.ts`)

```typescript
export interface SelectorBuilderInterface {
  ensureFunction(selector: string, tableName: string): string;
  escapeValue(value: string): string;
  buildFilter(tableName: string, fieldName: string, value: string): string;
  isSafeIdentifier(name: string): boolean;
}
```

| Methode              | Zweck                                              | Herkunft                      |
| -------------------- | -------------------------------------------------- | ----------------------------- |
| `ensureFunction()`   | Wrappet raw Expressions in `Filter()` (Compliance) | Neu fuer SOSO-365             |
| `escapeValue()`      | Escaped `"` und `\` gegen Injection-Angriffe       | Aus `AppSheetFilterEscape.ts` |
| `buildFilter()`      | Kombiniert Escaping + Filter()-Wrapper             | Aus `AppSheetFilterEscape.ts` |
| `isSafeIdentifier()` | Prueft Tabellen-/Feldnamen auf sichere Zeichen     | Aus `AppSheetFilterEscape.ts` |

#### Implementierung (`src/utils/SelectorBuilder.ts`)

```typescript
export class SelectorBuilder implements SelectorBuilderInterface {
  ensureFunction(selector: string, tableName: string): string {
    const trimmed = selector.trim();
    const alreadyWrapped = SELECTOR_FUNCTIONS.some((fn) => trimmed.startsWith(fn));
    if (alreadyWrapped) return trimmed; // Idempotent
    return `Filter(${tableName}, ${trimmed})`;
  }

  escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\') // Backslashes zuerst
      .replace(/"/g, '\\"'); // Dann Quotes
  }

  buildFilter(tableName: string, fieldName: string, value: string): string {
    return `Filter(${tableName}, ${fieldName} = "${this.escapeValue(value)}")`;
  }

  isSafeIdentifier(name: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(name);
  }
}
```

#### Integration in `AppSheetClient` (DI-kompatibel)

Der `SelectorBuilder` wird ueber den Constructor injiziert (optionaler 3. Parameter).
Der Default ist `new SelectorBuilder()` -- bestehender Code bleibt kompatibel.

```typescript
export class AppSheetClient implements AppSheetClientInterface {
  private readonly selectorBuilder: SelectorBuilderInterface;

  constructor(
    connectionDef: ConnectionDefinition,
    runAsUserEmail: string,
    selectorBuilder?: SelectorBuilderInterface // Optionaler Injection-Point
  ) {
    this.selectorBuilder = selectorBuilder ?? new SelectorBuilder();
    // ...
  }

  async find<T>(options: FindOptions): Promise<FindResponse<T>> {
    const properties = this.mergeProperties(options.properties);
    if (options.selector) {
      // NACHHER (Fix): Automatisches Wrapping in Filter()
      properties.Selector = this.selectorBuilder.ensureFunction(
        options.selector,
        options.tableName
      );
    }
    // ...
  }
}
```

#### Integration in `AppSheetClientFactory` (DI-Durchreichung)

Die Factory nimmt optional einen `SelectorBuilderInterface` entgegen und reicht ihn
an alle erzeugten `AppSheetClient`-Instanzen weiter.

**Wichtig:** `AppSheetClientFactoryInterface.create()` aendert sich NICHT -- kein Breaking Change.

```typescript
export class AppSheetClientFactory implements AppSheetClientFactoryInterface {
  private readonly selectorBuilder: SelectorBuilderInterface;

  constructor(selectorBuilder?: SelectorBuilderInterface) {
    this.selectorBuilder = selectorBuilder ?? new SelectorBuilder();
  }

  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new AppSheetClient(connectionDef, runAsUserEmail, this.selectorBuilder);
  }
}
```

### DI-Kompatibilitaet (tsyringe)

#### Problem: Hardcoded SelectorBuilder bricht mit v3.0.0 Factory-Pattern

Die v3.0.0-Architektur setzt konsequent auf Factory-Injection fuer Austauschbarkeit:

- `AppSheetClientFactoryInterface` -- Real/Mock-Client austauschbar
- `DynamicTableFactoryInterface` -- Real/Mock-Table austauschbar
- **`SelectorBuilderInterface`** -- bisher NICHT austauschbar (hardcoded `new SelectorBuilder()`)

Ein hardcoded `new SelectorBuilder()` im Constructor wuerde dieses Pattern brechen.
Consumer-Projekte wie `service_portfolio_mcp` registrieren alle Dependencies ueber
tsyringe-Tokens und erwarten, dass Implementierungen austauschbar sind.

#### Loesung: Injection ueber Factory-Constructor (Option B)

Der `SelectorBuilder` wird ueber den `AppSheetClientFactory`-Constructor injiziert.
Die Injection-Kette ist:

```
DI Container (tsyringe)
  |
  +---> AppSheetClientFactory(selectorBuilder?)    <-- hier Builder injecten
           |
           +---> .create(connectionDef, userEmail)
                    |
                    +---> new AppSheetClient(def, email, selectorBuilder)  <-- durchgereicht
                             |
                             +---> this.selectorBuilder.ensureFunction(...)  <-- genutzt
```

**Warum Option B (Factory-Constructor) statt anderer Optionen:**

| Option | Ansatz                                       | Factory-Interface-Aenderung | Bewertung         |
| ------ | -------------------------------------------- | --------------------------- | ----------------- |
| A      | Optional im AppSheetClient-Constructor       | Nein                        | DI nur direkt     |
| **B**  | **Ueber AppSheetClientFactory durchreichen** | **Nein**                    | **DI-kompatibel** |
| C      | Hardcoded lassen, dokumentieren              | Nein                        | Bricht DI-Pattern |
| D      | Eigenes Factory-Interface fuer Builder       | Ja (neues Token)            | Over-Engineering  |

Option B wurde gewaehlt, weil:

1. `AppSheetClientFactoryInterface.create()` bleibt unveraendert -- **kein Breaking Change**
2. Consumer-Projekte koennen ueber den Factory-Constructor einen eigenen Builder injecten
3. Default-Verhalten bleibt identisch (kein Argument = Standard-SelectorBuilder)
4. Bestehende DI-Registrierungen in Consumer-Projekten bleiben kompatibel

#### Konkrete DI-Szenarien in Consumer-Projekten

**Szenario 1: Default (kein eigener Builder)**

Keine Aenderung noetig. Bestehende Registrierung funktioniert weiter:

```typescript
// container.base.ts -- bleibt identisch
container.register(TOKENS.AppSheetClientFactory, {
  useFactory: () => new AppSheetClientFactory(), // Default-SelectorBuilder intern
});
```

**Szenario 2: Custom SelectorBuilder injecten**

```typescript
container.register(TOKENS.AppSheetClientFactory, {
  useFactory: () => new AppSheetClientFactory(new CustomSelectorBuilder()),
});
```

**Szenario 3: SelectorBuilder als eigenes DI-Token**

```typescript
container.register(TOKENS.SelectorBuilder, {
  useClass: CustomSelectorBuilder,
});

container.register(TOKENS.AppSheetClientFactory, {
  useFactory: (c) => {
    const builder = c.resolve<SelectorBuilderInterface>(TOKENS.SelectorBuilder);
    return new AppSheetClientFactory(builder);
  },
});
```

### AOP-Erweiterbarkeit

#### Kontext: AOP-basiertes Logging in Consumer-Projekten

Das `service_portfolio_mcp`-Projekt verwendet TypeScript Method Decorators fuer
aspektorientiertes Logging (`@LogExecution`, `@LogPerformance`, `@HandleError`).
Manuelle `logger.info()`-Aufrufe sind dort verboten (Story 8.12).

Die AOP-Decorators werden auf **Klassen-Methoden** angewandt -- sie funktionieren
nicht mit losen Funktionen. Das ist ein wichtiger Grund, warum der SelectorBuilder
als **Klasse mit Interface** implementiert wird statt als einzelne Utility-Funktionen.

#### Warum die Klassen-Architektur AOP ermoeglicht

Die `SelectorBuilder`-Klasse selbst braucht kein AOP-Logging -- sie ist ein
stateless, synchrones Utility ohne I/O. Aber die Klassen-Architektur mit
`SelectorBuilderInterface` ermoeglicht Consumern, bei Bedarf eine eigene
Subklasse mit AOP-Decorators zu erstellen und ueber DI (Option B) zu injecten:

```typescript
// Im Consumer-Projekt (z.B. service_portfolio_mcp):
class LoggedSelectorBuilder extends SelectorBuilder {
  @LogExecution({ level: 'debug' })
  ensureFunction(selector: string, tableName: string): string {
    return super.ensureFunction(selector, tableName);
  }

  @LogExecution({ level: 'debug' })
  buildFilter(tableName: string, fieldName: string, value: string): string {
    return super.buildFilter(tableName, fieldName, value);
  }
}

// DI-Registration:
container.register(TOKENS.AppSheetClientFactory, {
  useFactory: () => new AppSheetClientFactory(new LoggedSelectorBuilder()),
});
```

**Ohne** Option B waere das nicht moeglich -- der hardcoded `new SelectorBuilder()`
im AppSheetClient-Constructor liesse sich nicht durch eine AOP-erweiterte
Subklasse austauschen.

#### Abgrenzung: Library vs. Consumer

| Aspekt                   | appsheet Library                 | Consumer-Projekte (z.B. MCP)    |
| ------------------------ | -------------------------------- | ------------------------------- |
| Logging-Framework        | Keins (bewusst)                  | Pino via AOP-Decorators         |
| `experimentalDecorators` | Nein                             | Ja                              |
| SelectorBuilder-Logging  | Nicht noetig (stateless Utility) | Optional via Subklasse + DI     |
| Injection-Point          | Factory-Constructor (Option B)   | tsyringe `container.register()` |

Die Library stellt die **Erweiterungspunkte** bereit (Interface + optionaler
Constructor-Parameter). Die Entscheidung, ob und wie geloggt wird, liegt
beim Consumer-Projekt.

### Datenfluss nach Fix

```
Consumer-Code (z.B. MCP Service)
  |
  |  selector = '[service_portfolio_id]="abc-123"'
  |
  +---> DynamicTable.findOne(selector)
  |       |
  |       |  FindOptions { tableName: 'extract_sp', selector: '[sp_id]="abc-123"' }
  |       |
  |       +---> AppSheetClient.find(options)        <-- Realer Client
  |       |       |
  |       |       |  selectorBuilder.ensureFunction(...)
  |       |       |  Properties.Selector = 'Filter(extract_sp, [sp_id]="abc-123")'
  |       |       |                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  |       |       |                         Automatisch gewrappet!
  |       |       |
  |       |       +---> HTTP POST an AppSheet API
  |       |
  |       +---> MockAppSheetClient.find(options)    <-- Mock Client (Tests)
  |               |
  |               |  applySelector(rows, '[sp_id]="abc-123"')
  |               |  Rohe Expression, direkt geparst (kein Wrapping)
  |               |
  |               +---> In-Memory Filterung
```

### Consumer-Nutzung (fuer MCP-Server / Services)

Consumer koennen den `SelectorBuilder` auch direkt importieren und nutzen:

```typescript
import { SelectorBuilder } from '@techdivision/appsheet';

const selector = new SelectorBuilder();

// Sicher: Escaped User-Input und wrappet in Filter()
const filter = selector.buildFilter('users', '[user_id]', userInput);
// => 'Filter(users, [user_id] = "escaped-value")'

// Oder einzeln:
const escaped = selector.escapeValue(userInput);
const expr = `[name] = "${escaped}" AND [status] = "Active"`;
```

---

## Fix 2: Default Base URL

### Problem

Default URL `https://api.appsheet.com/api/v2` ist deprecated.

### Loesung

```typescript
// NACHHER:
const baseUrl = connectionDef.baseUrl || 'https://www.appsheet.com/api/v2';
```

Regionale Endpunkte (EU, Asia Pacific) koennen weiterhin via `baseUrl` in der ConnectionDefinition konfiguriert werden.

---

## Vollstaendige Aenderungsliste

### Neue Dateien (3)

| Datei                                 | Beschreibung                                             |
| ------------------------------------- | -------------------------------------------------------- |
| `src/types/selector.ts`               | `SelectorBuilderInterface` Definition                    |
| `src/utils/SelectorBuilder.ts`        | `SelectorBuilder` Klasse (Implementierung)               |
| `tests/utils/SelectorBuilder.test.ts` | Unit-Tests inkl. Injection-Attack-Prevention (40+ Tests) |

### Zu aendernde Dateien (8)

| Datei                                    | Aenderung                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/client/AppSheetClient.ts`           | 3. optionaler Constructor-Parameter `selectorBuilder?`, `ensureFunction()` in `find()`, Default URL |
| `src/client/AppSheetClientFactory.ts`    | Constructor mit optionalem `selectorBuilder?`, Durchreichung an `AppSheetClient`                    |
| `src/types/index.ts`                     | Export `selector` Types                                                                             |
| `src/utils/index.ts`                     | Export `SelectorBuilder`                                                                            |
| `src/types/config.ts`                    | Kommentar: Default URL aktualisiert                                                                 |
| `src/types/schema.ts`                    | Kommentar: Default URL dokumentiert                                                                 |
| `tests/client/AppSheetClient.test.ts`    | Expected Selectors auf `Filter(tableName, ...)` angepasst                                           |
| `tests/client/AppSheetClient.v3.test.ts` | Test fuer Default-URL `www.appsheet.com` hinzugefuegt                                               |

### Unveraenderte Dateien

| Datei                                     | Grund                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| `src/client/MockAppSheetClient.ts`        | Empfaengt rohe `FindOptions.selector`, kein HTTP              |
| `src/client/DynamicTable.ts`              | Delegiert nur an Client-Interface                             |
| `src/types/operations.ts`                 | `FindOptions.selector` bleibt `string`                        |
| `src/types/factories.ts`                  | `AppSheetClientFactoryInterface.create()` bleibt unveraendert |
| `tests/client/DynamicTable.test.ts`       | Nutzt MockAppSheetClient, kein Filter()-Wrapping              |
| `tests/client/MockAppSheetClient.test.ts` | In-Memory-Tests, kein HTTP involviert                         |

---

## Test-Ergebnis

```
PASS tests/utils/SelectorBuilder.test.ts
PASS tests/client/MockAppSheetClient.test.ts
PASS tests/client/DynamicTable.test.ts
PASS tests/client/AppSheetClient.test.ts
PASS tests/client/AppSheetClient.v3.test.ts
PASS tests/utils/ConnectionManager.test.ts
PASS tests/client/factories.test.ts
PASS tests/utils/SchemaManager.test.ts
PASS tests/cli/SchemaInspector.test.ts

Test Suites: 9 passed, 9 total
Tests:       265 passed, 265 total

Build: clean (0 errors)
Lint:  0 errors (108 pre-existing no-explicit-any warnings)
```

---

## Risikobewertung

| Risiko                                                      | Einstufung   | Mitigation                                           |
| ----------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| AppSheet API akzeptiert `Filter()` nicht                    | Sehr niedrig | Ist die offizielle, dokumentierte Syntax             |
| Double-Wrapping bei Consumern die bereits `Filter()` nutzen | Niedrig      | Idempotenz-Check in `ensureFunction()`               |
| `api.appsheet.com` wird abgeschaltet                        | Mittel       | Fix auf `www.appsheet.com` loest das                 |
| MockAppSheetClient Verhalten divergiert vom realen Client   | Niedrig      | Mock empfaengt weiterhin rohe Expression             |
| Consumer verwenden `baseUrl` Override mit altem Endpoint    | Kein Risiko  | Consumer-Konfiguration, nicht Library-Verantwortung  |
| Bestehende DI-Registrierungen in Consumer-Projekten brechen | Kein Risiko  | Factory-Interface unveraendert, Constructor optional |

---

## Follow-Up Tickets

- **Region-Feld in `ConnectionDefinition`** -- `region?: 'global' | 'eu' | 'asia-southeast'` mit automatischem URL-Mapping
- **`AppSheetFilterEscape` Cleanup im `service_portfolio_mcp`** -- Lokale Kopie durch Import aus `@techdivision/appsheet` ersetzen, eigenes `escapeSelector()` in `ServicePortfolioService` durch `SelectorBuilder.buildFilter()` ersetzen
