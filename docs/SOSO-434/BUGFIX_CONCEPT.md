# SOSO-434: MockAppSheetClient.getKeyField() Schema-Lookup statt hardcoded Map

## Status: Konzeptphase

## Overview

`MockAppSheetClient.getKeyField()` verwendet eine hardcoded Map mit nur 3 von 6 Tabellen. Fuer Tabellen die nicht in der Map enthalten sind, wird auf `'id'` zurueckgefallen — ein Feldname der in AppSheet nicht existiert. Der echte `AppSheetClient` hat dieses Problem nicht, da er das `keyField` aus der `TableDefinition` im Schema liest.

## Referenzen

- Jira: [SOSO-434](https://techdivision.atlassian.net/browse/SOSO-434)
- GitHub Issue: [#10](https://github.com/techdivision/appsheet/issues/10)
- Downstream Bug: BUG-ASUP-002 in `service_portfolio_mcp`

---

## Problem

### Aktueller Code (MockAppSheetClient.ts, Zeile 133-139)

```typescript
const keyFieldMap = {
  service_portfolio: 'service_portfolio_id',
  area: 'area_id',
  category: 'category_id',
  // ← solution, industry, ideal_customer_profile FEHLEN
};
return keyFieldMap[tableName] || 'id'; // ← Fallback auf 'id'
```

### Betroffene Tabellen

| Tabelle                  | Erwartetes keyField         | Aktuelles Ergebnis        |
| ------------------------ | --------------------------- | ------------------------- |
| `service_portfolio`      | `service_portfolio_id`      | ✅ `service_portfolio_id` |
| `area`                   | `area_id`                   | ✅ `area_id`              |
| `category`               | `category_id`               | ✅ `category_id`          |
| `solution`               | `solution_id`               | ❌ `id`                   |
| `industry`               | `industry_id`               | ❌ `id`                   |
| `ideal_customer_profile` | `ideal_customer_profile_id` | ❌ `id`                   |

### Auswirkung

Consumer die `MockAppSheetClient` fuer Tabellen ausserhalb der hardcoded Map nutzen, erhalten falsche Key-Field-Namen. Dies fuehrte zu Downstream-Workarounds im `service_portfolio_mcp`-Projekt, wo Services ein kuenstliches `id`-Feld zu Row-Objekten hinzufuegten (BUG-ASUP-002).

### Divergenz zwischen Real- und Mock-Client

| Aspekt                       | `AppSheetClient` (Real)             | `MockAppSheetClient` (Mock) |
| ---------------------------- | ----------------------------------- | --------------------------- |
| keyField-Quelle              | Schema (`TableDefinition.keyField`) | Hardcoded Map + Fallback    |
| Verhalten bei neuen Tabellen | Automatisch korrekt                 | Manuelles Map-Update noetig |
| Fehlerfall                   | Korrekt oder Exception              | Stiller Fallback auf `'id'` |

---

## Fix: Schema-Lookup statt hardcoded Map

### Design-Entscheidung

**Option A (bevorzugt): Schema-Lookup** — `getKeyField()` liest das `keyField` aus der `TableDefinition` im Schema. Damit verhaelt sich der Mock identisch zum echten Client.

**Option B (Minimum): Map erweitern** — Fehlende Tabellen zur hardcoded Map hinzufuegen. Loest das aktuelle Problem, aber nicht das grundsaetzliche Design-Problem.

Option A wird bevorzugt, weil:

1. Konsistenz mit dem echten `AppSheetClient`
2. Automatisch korrekt bei neuen Tabellen im Schema
3. Kein manuelles Map-Update bei Schema-Aenderungen noetig
4. Single Source of Truth (Schema)

### Loesung: Option A — Schema-Lookup

#### Wichtig: Lookup ueber echten Tabellennamen, nicht Schema-Namen

`getKeyField()` wird mit `options.tableName` aufgerufen — dem **echten AppSheet-Tabellennamen**
(z.B. `service_portfolio`, `solution`). Die `connectionDef.tables` sind aber nach **Schema-Namen**
geindext (z.B. `services`, `solutions`):

```yaml
# Schema-Struktur:
tables:
  solutions: # ← Schema-Name (Key in connectionDef.tables)
    tableName: solution # ← Echter AppSheet-Tabellenname (Parameter von getKeyField)
    keyField: solution_id
```

Daher funktioniert ein direkter Key-Lookup (`this.connectionDef.tables[tableName]`) **nicht**.
Stattdessen muessen alle Eintraege durchsucht und per `tableDef.tableName` gematcht werden.

#### Vorher (Bug)

```typescript
private getKeyField(tableName: string): string {
  const keyFieldMap: Record<string, string> = {
    service_portfolio: 'service_portfolio_id',
    area: 'area_id',
    category: 'category_id',
  };
  return keyFieldMap[tableName] || 'id';
}
```

#### Nachher (Fix)

```typescript
private getKeyField(tableName: string): string {
  // Schema-Lookup: Suche TableDefinition anhand des echten AppSheet-Tabellennamens
  // connectionDef.tables ist nach Schema-Namen geindext (z.B. 'solutions'),
  // aber getKeyField() erhaelt den echten Tabellennamen (z.B. 'solution').
  for (const tableDef of Object.values(this.connectionDef.tables)) {
    if (tableDef.tableName === tableName) {
      return tableDef.keyField;
    }
  }
  // Fallback: Convention-based (tableName + '_id')
  // Nur wenn Tabelle nicht in connectionDef definiert
  return `${tableName}_id`;
}
```

### Fallback-Strategie

| Szenario                                                     | Verhalten                            |
| ------------------------------------------------------------ | ------------------------------------ |
| Tabelle in connectionDef gefunden (via `tableDef.tableName`) | `TableDefinition.keyField` (korrekt) |
| Tabelle NICHT in connectionDef definiert                     | Convention: `${tableName}_id`        |

Der Convention-basierte Fallback (`${tableName}_id`) ist sicherer als `'id'`, da alle AppSheet-Tabellen im Projekt dem Muster `{tablename}_id` folgen.

### Datenfluss nach Fix

```
Consumer-Code (z.B. MCP Service)
  |
  +---> MockAppSheetClient.getKeyField('solution')
          |
          |  1. Iteriere connectionDef.tables (geindext nach Schema-Namen)
          |  2. Finde Eintrag 'solutions' mit tableDef.tableName === 'solution'
          |  3. Return tableDef.keyField: 'solution_id' ✅
          |
          +---> (Fallback nur wenn nicht gefunden: 'solution_id' via Convention)
```

---

## Vollstaendige Aenderungsliste

### Zu aendernde Dateien (2)

| Datei                                     | Aenderung                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `src/client/MockAppSheetClient.ts`        | `getKeyField()` auf Schema-Lookup umstellen, hardcoded Map entfernen      |
| `tests/client/MockAppSheetClient.test.ts` | Tests fuer Schema-basiertes keyField, Fallback-Verhalten, alle 6 Tabellen |

### Unveraenderte Dateien

| Datei                          | Grund                                        |
| ------------------------------ | -------------------------------------------- |
| `src/client/AppSheetClient.ts` | Liest bereits aus Schema — kein Bug          |
| `src/client/DynamicTable.ts`   | Delegiert an Client-Interface                |
| `src/types/schema.ts`          | `TableDefinition.keyField` existiert bereits |

---

## Test-Strategie

### Neue Tests

```typescript
describe('MockAppSheetClient.getKeyField()', () => {
  // connectionDef.tables ist nach Schema-Namen geindext:
  //   { solutions: { tableName: 'solution', keyField: 'solution_id' }, ... }
  // getKeyField() erhaelt den echten Tabellennamen ('solution'), nicht den Schema-Namen ('solutions').

  it('should resolve keyField via tableDef.tableName lookup (not schema key)', () => {
    // getKeyField('solution') muss 'solutions'-Eintrag finden via tableDef.tableName === 'solution'
    expect(client.getKeyField('solution')).toBe('solution_id');
    expect(client.getKeyField('industry')).toBe('industry_id');
    expect(client.getKeyField('ideal_customer_profile')).toBe('ideal_customer_profile_id');
  });

  it('should work for tables that were already in the old hardcoded map', () => {
    // Rueckwaertskompatibilitaet: Bestehende Tabellen muessen weiterhin funktionieren
    expect(client.getKeyField('service_portfolio')).toBe('service_portfolio_id');
    expect(client.getKeyField('area')).toBe('area_id');
    expect(client.getKeyField('category')).toBe('category_id');
  });

  it('should use convention-based fallback for tables not in connectionDef', () => {
    expect(client.getKeyField('unknown_table')).toBe('unknown_table_id');
  });

  it('should NOT match by schema key name', () => {
    // 'solutions' ist der Schema-Name, nicht der echte Tabellenname
    // getKeyField('solutions') sollte NICHT 'solution_id' zurueckgeben
    // (es sei denn, es gibt zufaellig eine Tabelle mit tableName === 'solutions')
    // Stattdessen greift der Convention-Fallback
    expect(client.getKeyField('solutions')).toBe('solutions_id');
  });
});
```

### Bestehende Tests

Alle bestehenden `MockAppSheetClient`-Tests muessen weiterhin bestehen. Die Aenderung ist rueckwaertskompatibel, da die 3 Tabellen in der alten Map auch im Schema definiert sind.

---

## Risikobewertung

| Risiko                                        | Einstufung   | Mitigation                                       |
| --------------------------------------------- | ------------ | ------------------------------------------------ |
| Schema nicht geladen bei getKeyField()-Aufruf | Niedrig      | Convention-basierter Fallback                    |
| Bestehende Tests brechen                      | Sehr niedrig | Gleiche Ergebnisse fuer die 3 bekannten Tabellen |
| Consumer verlassen sich auf 'id' Fallback     | Niedrig      | War ein Bug — kein gewolltes Verhalten           |

---

## Follow-Up

- **Downstream Cleanup:** `service_portfolio_mcp` — kuenstliches `id`-Feld aus Row-Objekten entfernen (BUG-ASUP-002)
- **Zusammenhang mit SOSO-435:** Die `validateRows()`-Erweiterung (unknown fields) haette diesen Bug fruehzeitig erkannt
