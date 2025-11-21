# SOSO-246: TSyringe DI Container Integration

**Status:** Konzeptphase
**JIRA:** https://techdivision.atlassian.net/browse/SOSO-246
**Repository:** https://github.com/techdivision/appsheet-mcp-server
**Branch:** staging
**Aktualisiert:** 2025-11-21 (Post-SOSO-247 v2.0.0)

> **⚠️ Hinweis:** Alle Beispiele in dieser Dokumentation wurden auf die v2.0.0 AppSheet field types aktualisiert (SOSO-247).

---

## Übersicht

Dieses Verzeichnis enthält die vollständige Konzeption für die Integration des TSyringe Dependency Injection Containers in die @techdivision/appsheet Library.

### Ziele

- ✅ Alle Core-Klassen (Real + Mock) mit DI-Support ausstatten
- ✅ Mock-Clients in Tests über DI-Container registrierbar machen
- ✅ Projekt-spezifische Test-Daten via `MockDataProvider` injizieren
- ✅ Zero Breaking Changes - bestehender Code funktioniert weiterhin
- ✅ Vollständige Test-Suite mit DI-basiertem Mock-Support

---

## Dokumentation

### 1. [INTEGRATION_CONCEPT.md](./INTEGRATION_CONCEPT.md)
**Hauptdokument mit vollständiger technischer Spezifikation**

Enthält:
- Executive Summary
- Architektur-Übersicht & Dependency Graph
- Implementierungsplan (Phase 1-4)
- Detaillierte Code-Änderungen für alle Klassen
- Migration Guide (Zero Breaking Changes)
- Rollout-Plan & Timeline
- Risiken & Mitigationen
- Success Criteria

**Empfohlen für:** Alle Stakeholder, Technical Lead, Implementierer

---

### 2. [EXAMPLES.md](./EXAMPLES.md)
**Umfassende Code-Beispiele für alle Use Cases**

Enthält:
- Basic Usage (Production & Test)
- Schema-basierte Examples
- Advanced Patterns (Multi-Connection, Hybrid Testing)
- Service Layer Integration
- MCP Server Integration
- Troubleshooting Examples
- Performance Optimization

**Empfohlen für:** Entwickler, die mit der Library arbeiten

---

### 3. [TESTING.md](./TESTING.md)
**Vollständige Testing-Strategie mit DI**

Enthält:
- Testing Philosophy & Test-Pyramide
- Unit Testing Strategy (Real + Mock + DI)
- Integration Testing Strategy
- Test Fixtures & Data Management
- Test Organization & Best Practices
- Performance Optimization
- CI/CD Integration
- Coverage Goals & Monitoring

**Empfohlen für:** QA, Test Engineers, Entwickler

---

## Quick Start

### Für Reviewer

1. **Konzept verstehen:**
   ```bash
   # Lies das Hauptdokument
   cat docs/SOSO-246/INTEGRATION_CONCEPT.md
   ```

2. **Code-Beispiele ansehen:**
   ```bash
   # Siehe konkrete Implementierungen
   cat docs/SOSO-246/EXAMPLES.md
   ```

3. **Testing-Strategie prüfen:**
   ```bash
   # Verstehe die Test-Architektur
   cat docs/SOSO-246/TESTING.md
   ```

### Für Implementierer

1. **Setup:**
   ```bash
   # Dependencies installieren
   npm install tsyringe reflect-metadata

   # tsconfig.json anpassen
   # Siehe INTEGRATION_CONCEPT.md Abschnitt 3.1
   ```

2. **Implementation starten:**
   ```bash
   # Branch erstellen
   git checkout -b feature/SOSO-246-di-integration

   # Phase 1: Core Setup (siehe INTEGRATION_CONCEPT.md)
   ```

3. **Tests schreiben:**
   ```bash
   # Test-Setup (siehe TESTING.md)
   # Parallel zur Implementation
   ```

---

## Roadmap

### ✅ Phase 0: Konzeption (Abgeschlossen)
- [x] Technische Spezifikation
- [x] JIRA Ticket erstellt
- [x] Dokumentation erstellt
- [x] Code-Beispiele erstellt

### 📋 Phase 1: Core Setup (Woche 1, Tag 1-2)
- [ ] Dependencies hinzufügen (tsyringe, reflect-metadata)
- [ ] tsconfig.json anpassen (experimentalDecorators, emitDecoratorMetadata)
- [ ] src/index.ts: reflect-metadata Import
- [ ] AppSheetClient @injectable machen
- [ ] MockAppSheetClient @injectable machen
- [ ] MockDatabase @singleton machen

### 📋 Phase 2: Utils & Management (Woche 1, Tag 3-5)
- [ ] ConnectionManager @injectable mit ClientFactory
- [ ] SchemaManager @injectable
- [ ] SchemaLoader DI-Support
- [ ] DynamicTable @injectable
- [ ] Injection Tokens definieren

### 📋 Phase 3: DI Helper & Testing (Woche 2, Tag 1-3)
- [ ] src/di/index.ts erstellen
- [ ] setupProductionContainer() Helper
- [ ] setupTestContainer() Helper
- [ ] setupIsolatedTestContainer() Helper
- [ ] Unit Tests (Real + Mock + DI)
- [ ] Integration Tests (Schema, Connections)
- [ ] Rückwärtskompatibilitäts-Tests

### 📋 Phase 4: Documentation & Release (Woche 2, Tag 4-5)
- [ ] DEPENDENCY_INJECTION.md erstellen
- [ ] TESTING.md aktualisieren
- [ ] API-Docs (TypeDoc) aktualisieren
- [ ] README.md aktualisieren
- [ ] Examples erstellen (Production + Test)
- [ ] CLAUDE.md aktualisieren

---

## Metrics & Success Criteria

### Funktionale Kriterien
- ✅ Alle Core-Klassen sind @injectable
- ✅ Mock-Client ist voll DI-kompatibel
- ✅ Tests können Mock/Real-Client via Container swappen
- ✅ Zero Breaking Changes
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

## Architektur-Übersicht

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

---

## Wichtige Design-Entscheidungen

### 1. Zero Breaking Changes
Alle Änderungen sind rückwärtskompatibel. Bestehender Code funktioniert ohne Änderungen:
```typescript
// ✅ Funktioniert weiterhin
const client = new AppSheetClient({ appId: 'xxx', applicationAccessKey: 'yyy' });
```

### 2. Interface-Token für Mock/Real-Swap
Tests können einfach Mock-Clients nutzen:
```typescript
// Test
container.register('AppSheetClient', { useClass: MockAppSheetClient });

// Production
container.register('AppSheetClient', { useClass: AppSheetClient });
```

### 3. Factory Pattern für ConnectionManager
ConnectionManager kann Mock- oder Real-Clients erstellen:
```typescript
container.register<ClientFactory>('ClientFactory', {
  useFactory: (c) => (config) => c.resolve(MockAppSheetClient)
});
```

### 4. Singleton vs. Isolated Database
```typescript
// Shared State
container.registerSingleton(MockDatabase);

// Isolated State
container.register(MockDatabase, { useClass: MockDatabase });
```

---

## Kontakt & Support

**Ticket:** [SOSO-246](https://techdivision.atlassian.net/browse/SOSO-246)
**Repository:** [appsheet-mcp-server](https://github.com/techdivision/appsheet-mcp-server)
**Branch:** `staging`

Bei Fragen oder Feedback bitte im JIRA-Ticket kommentieren oder PR erstellen.

---

## Next Steps

1. ✅ **Review:** Dieses Konzept von Technical Lead reviewen lassen
2. 📋 **Approval:** Go/No-Go Entscheidung
3. 💻 **Implementation:** Branch erstellen, Phase 1 starten
4. 🧪 **Testing:** Parallel zur Implementation
5. 📚 **Documentation:** Während Implementation
6. 🚀 **Release:** Merge nach staging → main

---

**Erstellt:** 2025-01-20
**Version:** 1.0
**Status:** Ready for Review
