# TSyringe DI Integration - Konzept & Integrationsvorschlag

**Ticket:** SOSO-246
**Projekt:** @techdivision/appsheet
**Status:** Konzeptphase
**Datum:** 2025-01-20
**Aktualisiert:** 2025-11-21 (Post-SOSO-247 v2.0.0)

> **⚠️ Wichtig:** Dieses Dokument berücksichtigt die Änderungen aus SOSO-247 (v2.0.0):
> - Alle Schema-Beispiele verwenden AppSheet field types (Text, Email, Enum, etc.)
> - Validators (AppSheetTypeValidator, FormatValidator) sind stateless und benötigen keine DI
> - FieldDefinition verwendet `allowedValues` statt `enum`

---

## 1. Executive Summary

Dieses Dokument beschreibt die vollständige Integration des TSyringe Dependency Injection Containers in die AppSheet-Library. Die Integration ermöglicht moderne, testbare und wartbare Architekturen durch:

- **Constructor Injection** für alle Core-Klassen
- **Interface-basierter Mock/Real-Swap** für Tests
- **Factory Patterns** für dynamische Client-Erstellung
- **Vollständige Rückwärtskompatibilität** mit bestehender manueller Instanziierung

### Kernziele

1. ✅ Alle Hauptklassen (Real + Mock) mit `@injectable()` Decorators ausstatten
2. ✅ Mock-Clients in Tests über DI-Container registrierbar machen
3. ✅ Projekt-spezifische Test-Daten via `MockDataProvider` injizieren
4. ✅ Zero Breaking Changes - bestehender Code funktioniert weiterhin

---

## 2. Architektur-Übersicht

### 2.1 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     DI Container                             │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  AppSheetConfig  │         │ MockDataProvider  │         │
│  │   (Token)        │         │   (Token)         │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                             │                    │
│           ▼                             ▼                    │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  AppSheetClient  │◄────────┤ MockAppSheetClient│         │
│  │   @injectable    │         │   @injectable     │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                             │                    │
│           │                    ┌────────▼─────────┐         │
│           │                    │   MockDatabase   │         │
│           │                    │    @singleton    │         │
│           │                    └──────────────────┘         │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ ConnectionManager│                                       │
│  │   @injectable    │                                       │
│  │  (uses Factory)  │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │  SchemaManager   │                                       │
│  │   @injectable    │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │  DynamicTable<T> │                                       │
│  │   @injectable    │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Injection Tokens

Alle Interface-basierten Injections nutzen String-Tokens:

| Token                  | Typ                          | Scope      | Zweck                                    |
|------------------------|------------------------------|------------|------------------------------------------|
| `AppSheetConfig`       | `AppSheetConfig`             | Container  | Client-Konfiguration (appId, accessKey)  |
| `AppSheetClient`       | `AppSheetClientInterface`    | Container  | Haupt-Interface für Real/Mock-Swap       |
| `MockDataProvider`     | `MockDataProvider`           | Container  | Projekt-spezifische Test-Daten           |
| `ClientFactory`        | `ClientFactory`              | Container  | Factory für ConnectionManager            |
| `SchemaConfig`         | `SchemaConfig`               | Container  | Schema-Definition                        |
| `TableDefinition`      | `TableDefinition`            | Scoped     | Pro-Table-Definition (Child Container)   |

---

## 3. Implementierungsplan

### Phase 1: Core Setup (Tag 1)

#### 3.1 Dependencies & Config

**package.json - Neue Dependencies:**
```json
{
  "dependencies": {
    "tsyringe": "^4.8.0",
    "reflect-metadata": "^0.1.13"
  }
}
```

**tsconfig.json - Compiler Options:**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,      // NEU
    "emitDecoratorMetadata": true        // NEU
  }
}
```

**src/index.ts - Reflect Metadata Import:**
```typescript
// WICHTIG: Reflect Metadata muss als erstes importiert werden
import 'reflect-metadata';

// Bestehende Exports (unverändert)
export * from './client';
export * from './types';
export * from './utils';

// NEU: DI-bezogene Exports
export { container, DependencyContainer } from 'tsyringe';
export * from './di';  // DI Helper-Funktionen
```

---

### Phase 2: Core Client Layer (Tag 1-2)

#### 3.2 AppSheetClient - Injectable

**Änderungen in src/client/AppSheetClient.ts:**

1. ✅ `@injectable()` Decorator hinzugefügen
2. ✅ `@inject('AppSheetConfig')` für Constructor-Parameter
3. ✅ TSDoc erweitern mit DI-Beispielen
4. ✅ Alle bestehenden Methoden bleiben **unverändert**
5. ✅ **Zero Breaking Changes** - manuelle Instanziierung funktioniert weiter

**Code-Snippet (Constructor):**
```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class AppSheetClient implements AppSheetClientInterface {
  constructor(
    @inject('AppSheetConfig') config: AppSheetConfig
  ) {
    // Bestehende Implementation unverändert
  }

  // Alle bestehenden Methoden bleiben unverändert
}
```

> 📖 **Vollständiges Beispiel:** Siehe [EXAMPLES.md Abschnitt 1.1](./EXAMPLES.md#11-production-setup---real-client)

---

#### 3.3 MockAppSheetClient - Injectable

**Änderungen in src/client/MockAppSheetClient.ts:**

1. ✅ `@injectable()` Decorator hinzugefügen
2. ✅ `@inject('AppSheetConfig')` für Config
3. ✅ `@inject('MockDataProvider') @optional()` für Test-Daten-Injection
4. ✅ `@inject(MockDatabase) @optional()` für Shared Database State
5. ✅ Fallback auf manuelle Instanziierung wenn keine DI

**Code-Snippet (Constructor):**
```typescript
import { injectable, inject, optional } from 'tsyringe';

@injectable()
export class MockAppSheetClient implements AppSheetClientInterface {
  constructor(
    @inject('AppSheetConfig') config: AppSheetConfig,
    @inject('MockDataProvider') @optional() dataProvider?: MockDataProvider,
    @inject(MockDatabase) @optional() database?: MockDatabase
  ) {
    // Bestehende Implementation + Auto-Seed von dataProvider
  }

  // Alle bestehenden Methoden bleiben unverändert
}
```

> 📖 **Vollständiges Beispiel:** Siehe [EXAMPLES.md Abschnitt 1.2](./EXAMPLES.md#12-test-setup---mock-client)

---

#### 3.4 MockDatabase - Singleton

**Änderungen in src/client/__mocks__/MockDatabase.ts:**

1. ✅ `@singleton()` Decorator hinzugefügen
2. ✅ TSDoc mit DI-Beispielen erweitern
3. ✅ Manuelle Instanziierung weiterhin möglich (Isolated State)

**Code-Snippet:**
```typescript
import { singleton } from 'tsyringe';

@singleton()
export class MockDatabase {
  // Bestehende Implementation unverändert
}
```

> 📖 **Shared vs. Isolated State:** Siehe [EXAMPLES.md Abschnitt 3.4](./EXAMPLES.md#34-shared-vs-isolated-database-state)

---

### Phase 3: Schema & Connection Management (Tag 2-3)

#### 3.5 ConnectionManager - Factory Pattern

**Änderungen in src/utils/ConnectionManager.ts:**

1. ✅ `@injectable()` Decorator hinzugefügen
2. ✅ `@inject('ClientFactory') @optional()` für Factory-Injection
3. ✅ `ClientFactory` Type exportieren für Test-Setup
4. ✅ Fallback auf direkte Client-Erstellung (Rückwärtskompatibilität)

**Code-Snippet:**
```typescript
import { injectable, inject, optional } from 'tsyringe';

export type ClientFactory = (config: ConnectionConfig) => AppSheetClientInterface;

@injectable()
export class ConnectionManager {
  constructor(
    @inject('ClientFactory') @optional()
    private clientFactory?: ClientFactory
  ) {}

  register(config: ConnectionConfig): void {
    // Factory wenn vorhanden, sonst direkte Instanziierung
    const client = this.clientFactory
      ? this.clientFactory(config)
      : new AppSheetClient(config);

    this.connections.set(config.name, client);
  }

  // Alle bestehenden Methoden bleiben unverändert
}
```

> 📖 **Multi-Connection Beispiel:** Siehe [EXAMPLES.md Abschnitt 3.1](./EXAMPLES.md#31-multi-connection-setup)

---

#### 3.6 SchemaManager - Injectable

**Änderungen in src/utils/SchemaManager.ts:**

1. ✅ `@injectable()` Decorator hinzugefügen
2. ✅ `@inject('SchemaConfig')` für Schema-Injection
3. ✅ `@inject(ConnectionManager)` optional (erbt DI-Setup von ConnectionManager)
4. ✅ Fallback auf manuelle ConnectionManager-Erstellung

**Code-Snippet:**
```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class SchemaManager {
  constructor(
    @inject('SchemaConfig') schema: SchemaConfig,
    @inject(ConnectionManager) connectionManager?: ConnectionManager
  ) {
    // Schema Validierung + Initialisierung
  }

  // Alle bestehenden Methoden bleiben unverändert
}
```

> 📖 **Schema-basierte Beispiele:** Siehe [EXAMPLES.md Abschnitt 2](./EXAMPLES.md#2-schema-based-examples)

---

#### 3.7 DynamicTable - Injectable

**Änderungen in src/client/DynamicTable.ts:**

1. ✅ `@injectable()` Decorator hinzugefügen
2. ✅ `@inject('AppSheetClient')` für Interface-Token
3. ✅ `@inject('TableDefinition')` für Table-Config

**Code-Snippet:**
```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class DynamicTable<T = Record<string, any>> {
  constructor(
    @inject('AppSheetClient') private client: AppSheetClientInterface,
    @inject('TableDefinition') private definition: TableDefinition
  ) {}

  // Alle bestehenden Methoden bleiben unverändert
}
```

**Hinweis:** DynamicTable wird typischerweise von SchemaManager erstellt, nicht direkt instanziiert.

---

#### 3.8 Validation Layer - NO DI Required

**Validators aus SOSO-247 (v2.0.0):**

Die neuen Validator-Klassen sind **stateless** und verwenden **statische Methoden**. Sie benötigen **KEINE Dependency Injection**:

```typescript
// src/utils/validators/AppSheetTypeValidator.ts
export class AppSheetTypeValidator {
  // Statische Methoden - keine DI nötig
  static validate(fieldName: string, fieldType: AppSheetFieldType, value: any, rowIndex: number): void
  static validateEnum(...): void
  static validateRequired(...): void
}

// src/utils/validators/FormatValidator.ts
export class FormatValidator {
  // Statische Methoden - keine DI nötig
  static validateEmail(fieldName: string, value: string, rowIndex: number): void
  static validateURL(...): void
  static validatePhone(...): void
}

// src/utils/validators/BaseTypeValidator.ts
export class BaseTypeValidator {
  // Statische Methoden - keine DI nötig
  static validateString(...): void
  static validateNumber(...): void
}
```

**Begründung:**
- Validators sind **pure functions** ohne State
- Keine Dependencies auf externe Services
- Performance-optimal durch statische Methoden
- Einfach testbar ohne DI-Setup

---

### Phase 4: DI Helper & Utilities (Tag 3)

#### 3.9 DI Helper Module

**Neues Modul: src/di/index.ts**

Drei Helper-Funktionen für schnelles Setup:

1. **`setupProductionContainer(config, schema?)`** - Real Client Setup
2. **`setupTestContainer(config, dataProvider?, schema?)`** - Mock Client mit Shared Database
3. **`setupIsolatedTestContainer(config, dataProvider?)`** - Mock Client mit isolierter Database

**Signatur:**
```typescript
// Production Setup
export function setupProductionContainer(
  config: AppSheetConfig,
  schema?: SchemaConfig
): DependencyContainer

// Test Setup (Shared Database)
export function setupTestContainer(
  config: AppSheetConfig,
  mockDataProvider?: MockDataProvider,
  schema?: SchemaConfig
): DependencyContainer

// Test Setup (Isolated Database)
export function setupIsolatedTestContainer(
  config: AppSheetConfig,
  mockDataProvider?: MockDataProvider
): DependencyContainer
```

> 📖 **Vollständige Implementation:** Siehe INTEGRATION_CONCEPT.md im Git-Repository (wird bei Implementation erstellt)
> 📖 **Usage-Beispiele:** Siehe [EXAMPLES.md Abschnitt 1](./EXAMPLES.md#1-basic-usage-examples)

---

## 4. Testing Strategy

Die vollständige Testing-Strategie ist in einem separaten Dokument ausgearbeitet.

### Test-Struktur

1. **Unit Tests** - Real & Mock Clients, DI-basiert
2. **Integration Tests** - Schema, ConnectionManager, Multi-Connection
3. **Test Fixtures** - YAML-basierte Test-Daten, Data Generators
4. **CI/CD Integration** - GitHub Actions, Coverage Reporting

### Key Testing Features

- ✅ Shared vs. Isolated Database State
- ✅ Container-Lifecycle-Management (beforeEach/afterEach)
- ✅ Custom MockDataProvider für projekt-spezifische Daten
- ✅ Performance-optimierte Container-Reuse
- ✅ Coverage-Targets: >90%

> 📖 **Vollständige Testing-Strategie:** Siehe [TESTING.md](./TESTING.md)

---

## 5. Migration Guide

### 5.1 Für bestehende Projekte

**Zero Breaking Changes** - Bestehender Code funktioniert weiterhin:

```typescript
// ✅ Weiterhin voll funktionsfähig
const client = new AppSheetClient({
  appId: process.env.APPSHEET_APP_ID!,
  applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!
});
```

**Optional: Schrittweise Migration zu DI:**

```typescript
// Schritt 1: reflect-metadata importieren
import 'reflect-metadata';

// Schritt 2: Container-Setup
container.register('AppSheetConfig', { useValue: { ... } });

// Schritt 3: Via DI auflösen
const client = container.resolve<AppSheetClientInterface>('AppSheetClient');
```

### 5.2 Für Test-Suiten

**Bestehende manuelle Mocks funktionieren weiterhin.**

**Optional: DI-basierte Tests:**

> 📖 **Migration-Beispiele:** Siehe [EXAMPLES.md Abschnitt 1.2](./EXAMPLES.md#12-test-setup---mock-client) und [TESTING.md Abschnitt 2](./TESTING.md#2-unit-testing-strategy)

---

## 6. Rollout-Plan

### Phase 1: Core Implementation (Woche 1)
- **Tag 1-2:** Dependencies, tsconfig, Core Clients (@injectable)
- **Tag 3:** Mock Infrastructure (@singleton, @injectable)
- **Tag 4-5:** ConnectionManager, SchemaManager, DynamicTable

### Phase 2: Testing & Documentation (Woche 2)
- **Tag 1-2:** DI Helper Module, Test Setup Utilities
- **Tag 3:** Unit Tests (DI-basiert)
- **Tag 4:** Integration Tests (Mock + Real)
- **Tag 5:** Rückwärtskompatibilitäts-Tests

### Phase 3: Documentation & Examples
- **Tag 1-2:** DEPENDENCY_INJECTION.md, TESTING.md
- **Tag 3:** API-Docs aktualisieren (TypeDoc)
- **Tag 4:** Examples erstellen (Production + Test)
- **Tag 5:** README.md aktualisieren

---

## 7. Success Criteria

### Funktionale Kriterien
- ✅ Alle Core-Klassen sind @injectable
- ✅ Mock-Client ist voll DI-kompatibel
- ✅ Tests können Mock/Real-Client via Container swappen
- ✅ Zero Breaking Changes - bestehender Code funktioniert
- ✅ Alle bestehenden Tests laufen durch

### Qualitäts-Kriterien
- ✅ Test Coverage: >90%
- ✅ TSDoc-Dokumentation für alle DI-Features
- ✅ Migration Guide verfügbar
- ✅ Examples für Production & Test

### Performance-Kriterien
- ✅ DI-Overhead <5ms pro Resolve
- ✅ Keine Memory Leaks bei Container-Reset
- ✅ Mock-Tests bleiben schnell (<100ms pro Test)

---

## 8. Risiken & Mitigationen

### Risiko 1: Breaking Changes
**Wahrscheinlichkeit:** Niedrig
**Impact:** Hoch
**Mitigation:**
- Alle Decorators sind optional
- Fallback auf manuelle Instanziierung
- Comprehensive Rückwärtskompatibilitäts-Tests

### Risiko 2: Decorator-Metadata-Konflikte
**Wahrscheinlichkeit:** Mittel
**Impact:** Mittel
**Mitigation:**
- reflect-metadata als erstes importieren
- Dokumentation mit Troubleshooting-Guide
- Peer Dependency Warning in package.json

### Risiko 3: Test-Performance
**Wahrscheinlichkeit:** Niedrig
**Impact:** Mittel
**Mitigation:**
- Container-Reset in afterEach()
- Isolated Container pro Test-Suite
- Lazy Loading von Dependencies

---

## 9. Nächste Schritte

1. ✅ **Approval:** Review & Approval dieses Konzepts
2. 📋 **Setup:** Branch erstellen, Dependencies installieren
3. 💻 **Implementation:** Phase 1 starten (Core Clients)
4. 🧪 **Testing:** Parallel zu Implementation
5. 📚 **Documentation:** Während Implementation
6. 🚀 **Release:** Merge nach staging → main

---

## Anhang

### A. Related Documents
- [JIRA Ticket SOSO-246](https://techdivision.atlassian.net/browse/SOSO-246)
- [TSyringe Documentation](https://github.com/microsoft/tsyringe)
- [CLAUDE.md](../CLAUDE.md)
- [TECHNICAL_CONCEPTION.md](../TECHNICAL_CONCEPTION.md)

### B. Code Examples
Siehe separates Dokument: `docs/SOSO-246/EXAMPLES.md`

### C. Testing Scenarios
Siehe separates Dokument: `docs/SOSO-246/TESTING.md`
