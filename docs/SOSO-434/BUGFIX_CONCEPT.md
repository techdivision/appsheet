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
  'service_portfolio': 'service_portfolio_id',
  'area': 'area_id',
  'category': 'category_id',
  // ← solution, industry, ideal_customer_profile FEHLEN
};
return keyFieldMap[tableName] || 'id';  // ← Fallback auf 'id'
```

### Betroffene Tabellen

| Tabelle | Erwartetes keyField | Aktuelles Ergebnis |
|---------|--------------------|--------------------|
| `service_portfolio` | `service_portfolio_id` | ✅ `service_portfolio_id` |
| `area` | `area_id` | ✅ `area_id` |
| `category` | `category_id` | ✅ `category_id` |
| `solution` | `solution_id` | ❌ `id` |
| `industry` | `industry_id` | ❌ `id` |
| `ideal_customer_profile` | `ideal_customer_profile_id` | ❌ `id` |

### Auswirkung

Consumer die `MockAppSheetClient` fuer Tabellen ausserhalb der hardcoded Map nutzen, erhalten falsche Key-Field-Namen. Dies fuehrte zu Downstream-Workarounds im `service_portfolio_mcp`-Projekt, wo Services ein kuenstliches `id`-Feld zu Row-Objekten hinzufuegten (BUG-ASUP-002).

### Divergenz zwischen Real- und Mock-Client

| Aspekt | `AppSheetClient` (Real) | `MockAppSheetClient` (Mock) |
|--------|------------------------|-----------------------------|
| keyField-Quelle | Schema (`TableDefinition.keyField`) | Hardcoded Map + Fallback |
| Verhalten bei neuen Tabellen | Automatisch korrekt | Manuelles Map-Update noetig |
| Fehlerfall | Korrekt oder Exception | Stiller Fallback auf `'id'` |

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

#### Vorher (Bug)

```typescript
getKeyField(tableName: string): string {
  const keyFieldMap: Record<string, string> = {
    'service_portfolio': 'service_portfolio_id',
    'area': 'area_id',
    'category': 'category_id',
  };
  return keyFieldMap[tableName] || 'id';
}
```

#### Nachher (Fix)

```typescript
getKeyField(tableName: string): string {
  const definition = this.schema?.tables?.[tableName];
  if (definition?.keyField) {
    return definition.keyField;
  }
  // Fallback: Convention-based (tableName + '_id')
  // Nur wenn kein Schema vorhanden oder Tabelle nicht definiert
  return `${tableName}_id`;
}
```

### Fallback-Strategie

| Szenario | Verhalten |
|----------|-----------|
| Schema vorhanden, Tabelle definiert | `TableDefinition.keyField` (korrekt) |
| Schema vorhanden, Tabelle NICHT definiert | Convention: `${tableName}_id` |
| Kein Schema geladen | Convention: `${tableName}_id` |

Der Convention-basierte Fallback (`${tableName}_id`) ist sicherer als `'id'`, da alle AppSheet-Tabellen im Projekt dem Muster `{tablename}_id` folgen.

### Datenfluss nach Fix

```
Consumer-Code (z.B. MCP Service)
  |
  +---> MockAppSheetClient.getKeyField('solution')
          |
          |  1. Schema-Lookup: this.schema.tables['solution'].keyField
          |  2. Gefunden: 'solution_id'
          |  3. Return: 'solution_id' ✅
          |
          +---> (Fallback nur wenn Schema fehlt: 'solution_id' via Convention)
```

---

## Vollstaendige Aenderungsliste

### Zu aendernde Dateien (2)

| Datei | Aenderung |
|-------|-----------|
| `src/client/MockAppSheetClient.ts` | `getKeyField()` auf Schema-Lookup umstellen, hardcoded Map entfernen |
| `tests/client/MockAppSheetClient.test.ts` | Tests fuer Schema-basiertes keyField, Fallback-Verhalten, alle 6 Tabellen |

### Unveraenderte Dateien

| Datei | Grund |
|-------|-------|
| `src/client/AppSheetClient.ts` | Liest bereits aus Schema — kein Bug |
| `src/client/DynamicTable.ts` | Delegiert an Client-Interface |
| `src/types/schema.ts` | `TableDefinition.keyField` existiert bereits |

---

## Test-Strategie

### Neue Tests

```typescript
describe('MockAppSheetClient.getKeyField()', () => {
  it('should return keyField from schema for known tables', () => {
    // Alle 6 Tabellen pruefen
    expect(client.getKeyField('solution')).toBe('solution_id');
    expect(client.getKeyField('industry')).toBe('industry_id');
    expect(client.getKeyField('ideal_customer_profile')).toBe('ideal_customer_profile_id');
  });

  it('should use convention-based fallback for unknown tables', () => {
    expect(client.getKeyField('unknown_table')).toBe('unknown_table_id');
  });

  it('should match real AppSheetClient behavior', () => {
    // Sicherstellen dass Mock und Real identisch antworten
    for (const tableName of Object.keys(schema.tables)) {
      expect(mockClient.getKeyField(tableName))
        .toBe(realClient.getKeyField(tableName));
    }
  });
});
```

### Bestehende Tests

Alle bestehenden `MockAppSheetClient`-Tests muessen weiterhin bestehen. Die Aenderung ist rueckwaertskompatibel, da die 3 Tabellen in der alten Map auch im Schema definiert sind.

---

## Risikobewertung

| Risiko | Einstufung | Mitigation |
|--------|------------|------------|
| Schema nicht geladen bei getKeyField()-Aufruf | Niedrig | Convention-basierter Fallback |
| Bestehende Tests brechen | Sehr niedrig | Gleiche Ergebnisse fuer die 3 bekannten Tabellen |
| Consumer verlassen sich auf 'id' Fallback | Niedrig | War ein Bug — kein gewolltes Verhalten |

---

## Follow-Up

- **Downstream Cleanup:** `service_portfolio_mcp` — kuenstliches `id`-Feld aus Row-Objekten entfernen (BUG-ASUP-002)
- **Zusammenhang mit SOSO-435:** Die `validateRows()`-Erweiterung (unknown fields) haette diesen Bug fruehzeitig erkannt
