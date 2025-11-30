# v3.0.0: Client Factory Injection for DI and Testing

## Overview

Enable dependency injection (DI) and testing support by injecting a `AppSheetClientFactoryInterface` into `ConnectionManager`. This allows creating user-specific clients (real or mock) at runtime while maintaining full testability.

This is a **breaking change** requiring a major version bump to v3.0.0.

## Multi-Connection Support

**Definition**: Multi-Connection means integrating multiple AppSheet applications within a single MCP server or application.

**Example Use Case** (appsheet-schema.json):
```json
{
  "connections": {
    "worklog": {
      "appId": "${WORKLOG_APP_ID}",
      "applicationAccessKey": "${WORKLOG_KEY}",
      "tables": {
        "worklogs": { "..." : "..." },
        "issues": { "..." : "..." }
      }
    },
    "hr": {
      "appId": "${HR_APP_ID}",
      "applicationAccessKey": "${HR_KEY}",
      "tables": {
        "employees": { "..." : "..." },
        "departments": { "..." : "..." }
      }
    },
    "inventory": {
      "appId": "${INVENTORY_APP_ID}",
      "applicationAccessKey": "${INVENTORY_KEY}",
      "tables": {
        "products": { "..." : "..." },
        "warehouses": { "..." : "..." }
      }
    }
  }
}
```

**Usage in Service**:
```typescript
// Access different AppSheet apps via connectionName
const worklogs = await schemaManager.table('worklog', 'worklogs', userEmail).findAll();
const employees = await schemaManager.table('hr', 'employees', userEmail).findAll();
const products = await schemaManager.table('inventory', 'products', userEmail).findAll();
```

Each connection represents a separate AppSheet application with its own `appId` and `applicationAccessKey`. The `connectionName` parameter identifies which app to use.

## Problem Statement

The current `SchemaManager` cannot be used with `MockAppSheetClient` for testing because:

1. **SchemaManager constructor** only accepts `SchemaConfig`, not a pre-configured `ConnectionManager`
2. **ConnectionManager** always creates a new `AppSheetClient` internally, bypassing any injected mock
3. **User-specific client creation** hardcodes `new AppSheetClient()`, making it untestable

This makes it impossible to inject a `MockAppSheetClient` for unit/integration testing while using the SchemaManager API with its automatic validation features.

## Primary Use Case: TSyringe DI with Per-Request User Context

```typescript
// Service uses SchemaManager with per-request user context
@injectable()
export class ServicePortfolioService {
  constructor(
    @inject("SchemaManager") private readonly schemaManager: SchemaManager
  ) {}

  async listServices(userEmail: string, filters?: ServiceFilters) {
    const table = this.schemaManager.table<ServicePortfolio>(
      'default',           // connectionName
      'service_portfolio', // tableName
      userEmail            // ← Per-request user context (REQUIRED)
    );
    return await table.findAll();
  }
}

// DI Container setup
export function registerAppSheet(c: DependencyContainer): void {
  // Register client factory (swap for MockAppSheetClientFactory in tests)
  c.register(TOKENS.AppSheetClientFactory, {
    useClass: AppSheetClientFactory
  });

  // Register ConnectionManager with factory and schema
  c.register(TOKENS.ConnectionManager, {
    useFactory: (container) => {
      const clientFactory = container.resolve(TOKENS.AppSheetClientFactory);
      const schema = SchemaLoader.fromJson('config/appsheet-schema.json');
      return new ConnectionManager(clientFactory, schema);
    }
  });

  // Register DynamicTableFactory
  c.register(TOKENS.DynamicTableFactory, {
    useFactory: (container) => {
      const connectionManager = container.resolve(TOKENS.ConnectionManager);
      return new DynamicTableFactory(connectionManager);
    }
  });

  // Register SchemaManager
  c.register(TOKENS.SchemaManager, {
    useFactory: (container) => {
      const connectionManager = container.resolve(TOKENS.ConnectionManager);
      const tableFactory = container.resolve(TOKENS.DynamicTableFactory);
      return new SchemaManager(connectionManager, tableFactory);
    }
  });
}

// Test setup: Swap client factory for mock
container.register(TOKENS.AppSheetClientFactory, {
  useClass: MockAppSheetClientFactory
});
```

## Breaking Changes in v3.0.0

### 1. NEW: AppSheetClientFactoryInterface

Factory interface for instantiating clients with user context. Accepts `ConnectionDefinition` directly from schema.

```typescript
export interface AppSheetClientFactoryInterface {
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface;
}
```

### 2. NEW: AppSheetClientFactory (Real Implementation)

```typescript
export class AppSheetClientFactory implements AppSheetClientFactoryInterface {
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new AppSheetClient(connectionDef, runAsUserEmail);
  }
}
```

### 3. NEW: MockAppSheetClientFactory (Test Implementation)

```typescript
export class MockAppSheetClientFactory implements AppSheetClientFactoryInterface {
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new MockAppSheetClient(connectionDef, runAsUserEmail);
  }
}
```

### 4. CHANGED: AppSheetClientInterface - New getTable() Method

**Before (v2.x):**
```typescript
interface AppSheetClientInterface {
  findAll<T>(tableName: string): Promise<T[]>;
  find<T>(options: FindOptions): Promise<T[]>;
  add<T>(tableName: string, rows: T[]): Promise<T[]>;
  // ... other CRUD methods
  getConfig(): AppSheetClientConfig;
}
```

**After (v3.0.0):**
```typescript
interface AppSheetClientInterface {
  findAll<T>(tableName: string): Promise<T[]>;
  find<T>(options: FindOptions): Promise<T[]>;
  add<T>(tableName: string, rows: T[]): Promise<T[]>;
  // ... other CRUD methods
  getTable(tableName: string): TableDefinition;  // NEW
}
```

The interface now includes `getTable()` for accessing table definitions.

### 5. CHANGED: AppSheetClient - Accepts Full ConnectionDefinition

**Before (v2.x):**
```typescript
constructor(config: AppSheetClientConfig);
```

**After (v3.0.0):**
```typescript
constructor(connectionDef: ConnectionDefinition, runAsUserEmail: string);

// NEW: Get table definition
getTable(tableName: string): TableDefinition;
```

The client now knows its complete configuration including all table definitions.

### 6. NEW: DynamicTableFactoryInterface

Factory interface for creating DynamicTable instances.

```typescript
export interface DynamicTableFactoryInterface {
  create<T>(connectionName: string, tableName: string, runAsUserEmail: string): DynamicTable<T>;
}
```

### 7. NEW: DynamicTableFactory (Real Implementation)

```typescript
export class DynamicTableFactory implements DynamicTableFactoryInterface {
  constructor(private connectionManager: ConnectionManager) {}

  create<T>(connectionName: string, tableName: string, runAsUserEmail: string): DynamicTable<T> {
    const client = this.connectionManager.get(connectionName, runAsUserEmail);
    return new DynamicTable<T>(client, client.getTable(tableName));
  }
}
```

### 8. ConnectionManager - Complete Redesign

**Before (v2.x):**
```typescript
class ConnectionManager {
  constructor();
  register(config: ConnectionConfig): void;
  get(name: string, runAsUserEmail?: string): AppSheetClient;
  has(name: string): boolean;
  remove(name: string): boolean;
  list(): string[];
  clear(): void;
  ping(name: string): Promise<boolean>;
  healthCheck(): Promise<Record<string, boolean>>;
}
```

**After (v3.0.0):**
```typescript
class ConnectionManager {
  constructor(
    clientFactory: AppSheetClientFactoryInterface,
    schema: SchemaConfig
  );
  get(connectionName: string, runAsUserEmail: string): AppSheetClientInterface;
}
```

**Removed:**
- `register()` - Schema is injected via constructor
- `has()`, `remove()`, `list()`, `clear()` - No connection pool anymore
- `ping()`, `healthCheck()` - Can be done directly on client if needed

**Changed:**
- `get()` now requires both `connectionName` and `runAsUserEmail` (both required)

### 9. SchemaManager Constructor - ConnectionManager + TableFactory

**Before (v2.x):**
```typescript
constructor(schema: SchemaConfig);
```

**After (v3.0.0):**
```typescript
constructor(connectionManager: ConnectionManager, tableFactory: DynamicTableFactoryInterface);
```

**Note:**
- Schema is accessed via ConnectionManager
- Table creation is delegated to DynamicTableFactory
- The `initialize()` method is **REMOVED** - DI handles all initialization

### 10. SchemaManager.table() - Delegates to TableFactory

**Before (v2.x):**
```typescript
table<T>(connectionName: string, tableName: string, runAsUserEmail?: string): DynamicTable<T>;
```

**After (v3.0.0):**
```typescript
table<T>(connectionName: string, tableName: string, runAsUserEmail: string): DynamicTable<T>;
// Implementation: return this.tableFactory.create<T>(connectionName, tableName, runAsUserEmail);
```

**Changed:**
- `runAsUserEmail` is now required (was optional)
- Delegates to `DynamicTableFactory` instead of creating table internally

### 11. SchemaConfig - Structure Unchanged

The schema structure remains the same with `connections` hierarchy:

```json
{
  "connections": {
    "worklog": {
      "appId": "${APP_ID}",
      "applicationAccessKey": "${KEY}",
      "tables": {
        "worklogs": {
          "tableName": "extract_worklog",
          "keyField": "id",
          "fields": {}
        }
      }
    }
  }
}
```

### 12. ConnectionConfig Type - Removed

The `ConnectionConfig` type is no longer needed and will be removed.

## Schema Validation (Unchanged)

The schema-based validation remains **unchanged** in v3.0.0. Validation happens in `DynamicTable`, not in the factories or managers.

### Validation Flow

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ SchemaManager   │────▶│ DynamicTableFactory│────▶│  DynamicTable   │
│   .table()      │     │     .create()      │     │                 │
└─────────────────┘     └───────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ TableDefinition │
                                                  │  (from client)  │
                                                  └────────┬────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────┐
                                              │   validateRows()       │
                                              │   - Required fields    │
                                              │   - Type validation    │
                                              │   - Enum validation    │
                                              └────────────────────────┘
```

### Where Validation Happens

**DynamicTable.validateRows()** performs all schema-based validation:

```typescript
// DynamicTable (unchanged in v3.0.0)
export class DynamicTable<T> {
  constructor(
    private client: AppSheetClientInterface,  // Changed: Interface instead of concrete class
    private definition: TableDefinition       // Unchanged: Still receives TableDefinition
  ) {}

  async add(rows: Partial<T>[]): Promise<T[]> {
    this.validateRows(rows);  // ← Validation happens here
    // ... API call
  }

  async update(rows: Partial<T>[]): Promise<T[]> {
    this.validateRows(rows, false);  // ← Validation happens here (skip required check)
    // ... API call
  }

  private validateRows(rows: Partial<T>[], checkRequired = true): void {
    for (const row of rows) {
      for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
        // 1. Required field validation
        if (checkRequired && fieldDef.required) {
          AppSheetTypeValidator.validateRequired(fieldName, ...);
        }

        // 2. Type validation (Email, URL, Phone, Date, Number, etc.)
        AppSheetTypeValidator.validate(fieldName, fieldDef.type, value, ...);

        // 3. Enum/EnumList validation
        if (fieldDef.allowedValues) {
          AppSheetTypeValidator.validateEnum(fieldName, fieldDef.type, fieldDef.allowedValues, value, ...);
        }
      }
    }
  }
}
```

### How TableDefinition Flows in v3.0.0

```typescript
// 1. Schema loaded at startup
const schema = SchemaLoader.fromJson('config/appsheet-schema.json');
// schema.connections['worklog'].tables['worklogs'] = TableDefinition

// 2. ConnectionManager receives schema
const connectionManager = new ConnectionManager(clientFactory, schema);

// 3. Factory creates client with full ConnectionDefinition (includes tables)
const client = connectionManager.get('worklog', 'user@example.com');
// client has: connectionDef.tables['worklogs'] = TableDefinition

// 4. DynamicTableFactory gets TableDefinition from client
const table = new DynamicTable<T>(client, client.getTable('worklogs'));
//                                         ↑ Returns TableDefinition

// 5. DynamicTable uses TableDefinition for validation
await table.add([{ ... }]);  // validateRows() uses this.definition
```

### What Changes, What Stays

| Component | v2.x | v3.0.0 | Validation Role |
|-----------|------|--------|-----------------|
| SchemaManager | Creates DynamicTable | Delegates to factory | None |
| ConnectionManager | Creates clients | Delegates to factory | None |
| AppSheetClient | No table knowledge | Has `getTable()` | None (just provides TableDefinition) |
| **DynamicTable** | **Validates rows** | **Validates rows** | **All validation happens here** |
| AppSheetTypeValidator | Validation logic | Validation logic | Unchanged |

**Key Point**: The validation logic in `DynamicTable` and `AppSheetTypeValidator` remains **completely unchanged**. Only the way `TableDefinition` is passed to `DynamicTable` changes (via `client.getTable()` instead of direct schema lookup).

## Proposed Solution

### AppSheetClientFactoryInterface

```typescript
/**
 * Factory interface for instantiating AppSheet clients with user context.
 * Accepts ConnectionDefinition directly from schema.
 * Enables DI and testability by allowing mock factories in tests.
 */
export interface AppSheetClientFactoryInterface {
  /**
   * Create a new client instance with user context.
   *
   * @param connectionDef - Connection definition from schema (appId, applicationAccessKey, tables, etc.)
   * @param runAsUserEmail - Email of the user to execute operations as
   * @returns A new client instance configured for the user
   */
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface;
}
```

### AppSheetClientFactory (Real)

```typescript
/**
 * Factory for creating real AppSheet clients.
 * Used in production environments.
 */
export class AppSheetClientFactory implements AppSheetClientFactoryInterface {
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new AppSheetClient(connectionDef, runAsUserEmail);
  }
}
```

### MockAppSheetClientFactory (Test)

```typescript
/**
 * Factory for creating mock AppSheet clients.
 * Used in test environments.
 */
export class MockAppSheetClientFactory implements AppSheetClientFactoryInterface {
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new MockAppSheetClient(connectionDef, runAsUserEmail);
  }
}
```

### AppSheetClient v3.0.0

```typescript
/**
 * AppSheet API client with full connection configuration.
 * Knows its credentials, settings AND table definitions.
 */
export class AppSheetClient implements AppSheetClientInterface {
  constructor(
    private connectionDef: ConnectionDefinition,
    private runAsUserEmail: string
  ) {}

  /**
   * Get a table definition by name.
   *
   * @param tableName - Name of the table
   * @returns The table definition
   * @throws {Error} If table not found
   */
  getTable(tableName: string): TableDefinition {
    const tableDef = this.connectionDef.tables[tableName];
    if (!tableDef) {
      const available = Object.keys(this.connectionDef.tables).join(', ') || 'none';
      throw new Error(`Table "${tableName}" not found. Available tables: ${available}`);
    }
    return tableDef;
  }

  // API methods use this.connectionDef.appId, this.connectionDef.applicationAccessKey, etc.
  // ... findAll, find, add, update, delete methods unchanged
}
```

### ConnectionManager v3.0.0

```typescript
/**
 * Manages AppSheet client creation and initialization.
 * Resolves connection configuration from schema and delegates client creation to factory.
 * Supports multiple connections (AppSheet apps) via schema configuration.
 *
 * Responsibilities:
 * - Config resolution from schema (connectionName → ConnectionDefinition)
 * - Delegation to factory for client instantiation with user context
 */
export class ConnectionManager {
  /**
   * Create a new ConnectionManager.
   *
   * @param clientFactory - Factory for instantiating clients with user context (injected via DI)
   * @param schema - Schema configuration containing connection configs (injected via DI)
   */
  constructor(
    private clientFactory: AppSheetClientFactoryInterface,
    private schema: SchemaConfig
  ) {}

  /**
   * Get a user-specific client for a connection.
   *
   * Resolves the connection definition from schema and delegates to the factory
   * for client creation with user context.
   *
   * @param connectionName - Name of the connection (AppSheet app) as defined in schema
   * @param runAsUserEmail - Email of the user to execute operations as (required)
   * @returns A new client instance configured for the user
   * @throws {Error} If connection not found in schema
   */
  get(connectionName: string, runAsUserEmail: string): AppSheetClientInterface {
    const connDef = this.schema.connections[connectionName];
    if (!connDef) {
      const available = Object.keys(this.schema.connections).join(', ') || 'none';
      throw new Error(
        `Connection "${connectionName}" not found. Available connections: ${available}`
      );
    }

    return this.clientFactory.create(connDef, runAsUserEmail);
  }

  /**
   * Get the schema configuration.
   */
  getSchema(): SchemaConfig {
    return this.schema;
  }
}
```

### DynamicTableFactory v3.0.0

```typescript
/**
 * Factory for creating DynamicTable instances.
 * Delegates client creation to ConnectionManager and table lookup to client.
 */
export class DynamicTableFactory implements DynamicTableFactoryInterface {
  /**
   * Create a new DynamicTableFactory.
   *
   * @param connectionManager - ConnectionManager for client creation (injected via DI)
   */
  constructor(private connectionManager: ConnectionManager) {}

  /**
   * Create a DynamicTable for a specific user.
   *
   * @param connectionName - Name of the connection (AppSheet app)
   * @param tableName - The name of the table as defined in the schema
   * @param runAsUserEmail - Email of the user to execute operations as (required)
   */
  create<T = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    const client = this.connectionManager.get(connectionName, runAsUserEmail);
    return new DynamicTable<T>(client, client.getTable(tableName));
  }
}
```

### SchemaManager v3.0.0

```typescript
/**
 * High-level API for schema-based AppSheet operations.
 * Delegates table creation to DynamicTableFactory.
 */
export class SchemaManager {
  /**
   * Create a new SchemaManager.
   *
   * @param connectionManager - ConnectionManager for schema access (injected via DI)
   * @param tableFactory - Factory for creating DynamicTable instances (injected via DI)
   */
  constructor(
    private connectionManager: ConnectionManager,
    private tableFactory: DynamicTableFactoryInterface
  ) {}

  // initialize() method REMOVED - DI handles all initialization

  /**
   * Get a type-safe table client for a specific user.
   *
   * @param connectionName - Name of the connection (AppSheet app)
   * @param tableName - The name of the table as defined in the schema
   * @param runAsUserEmail - Email of the user to execute operations as (required)
   */
  table<T = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    return this.tableFactory.create<T>(connectionName, tableName, runAsUserEmail);
  }

  /**
   * Get all available connection names.
   */
  getConnections(): string[] {
    return Object.keys(this.connectionManager.getSchema().connections);
  }

  /**
   * Get all available table names for a connection.
   */
  getTables(connectionName: string): string[] {
    const schema = this.connectionManager.getSchema();
    const connDef = schema.connections[connectionName];
    if (!connDef) {
      throw new Error(`Connection "${connectionName}" not found`);
    }
    return Object.keys(connDef.tables);
  }

  /**
   * Get the current schema configuration.
   */
  getSchema(): SchemaConfig {
    return this.connectionManager.getSchema();
  }
}
```

## Migration Guide (v2.x → v3.0.0)

### Schema File - No Changes Required

The schema structure remains the same:

```json
{
  "connections": {
    "worklog": {
      "appId": "${APP_ID}",
      "applicationAccessKey": "${KEY}",
      "tables": {
        "worklogs": {
          "tableName": "extract_worklog",
          "keyField": "id",
          "fields": {
            "id": { "type": "Text", "required": true }
          }
        }
      }
    }
  }
}
```

### DI Container Setup

**Before (v2.x):**
```typescript
const schema = SchemaLoader.fromJson('./appsheet-schema.json');
const db = new SchemaManager(schema);
const table = db.table('worklog', 'worklogs', 'user@example.com');
```

**After (v3.0.0):**
```typescript
// Setup (once at startup)
const clientFactory = new AppSheetClientFactory();
const schema = SchemaLoader.fromJson('./appsheet-schema.json');
const connectionManager = new ConnectionManager(clientFactory, schema);
const tableFactory = new DynamicTableFactory(connectionManager);
const db = new SchemaManager(connectionManager, tableFactory);

// Usage (per request) - runAsUserEmail is now REQUIRED
const table = db.table('worklog', 'worklogs', 'user@example.com');
```

### TSyringe DI Container Example

```typescript
export function registerAppSheet(c: DependencyContainer): void {
  // Register client factory (swap for MockAppSheetClientFactory in tests)
  c.register(TOKENS.AppSheetClientFactory, { useClass: AppSheetClientFactory });

  // Register ConnectionManager
  c.register(TOKENS.ConnectionManager, {
    useFactory: (container) => {
      const clientFactory = container.resolve(TOKENS.AppSheetClientFactory);
      const schema = SchemaLoader.fromJson('config/appsheet-schema.json');
      return new ConnectionManager(clientFactory, schema);
    }
  });

  // Register DynamicTableFactory
  c.register(TOKENS.DynamicTableFactory, {
    useFactory: (container) => {
      const connectionManager = container.resolve(TOKENS.ConnectionManager);
      return new DynamicTableFactory(connectionManager);
    }
  });

  // Register SchemaManager
  c.register(TOKENS.SchemaManager, {
    useFactory: (container) => {
      const connectionManager = container.resolve(TOKENS.ConnectionManager);
      const tableFactory = container.resolve(TOKENS.DynamicTableFactory);
      return new SchemaManager(connectionManager, tableFactory);
    }
  });
}
```

### Test Setup

**Before (not possible with SchemaManager):**
```typescript
// Could only test with direct MockAppSheetClient, not SchemaManager
const mockClient = new MockAppSheetClient({ appId: 'mock', applicationAccessKey: 'mock' });
```

**After (full testability):**
```typescript
// Now SchemaManager is fully testable with mocks!
const mockFactory = new MockAppSheetClientFactory();
const schema = SchemaLoader.fromJson('./appsheet-schema.json');
const connectionManager = new ConnectionManager(mockFactory, schema);
const tableFactory = new DynamicTableFactory(connectionManager);
const db = new SchemaManager(connectionManager, tableFactory);

// All operations use MockAppSheetClient
const table = db.table('worklog', 'users', 'test@example.com');
const users = await table.findAll(); // Uses mock!
```

## Implementation Plan

### Phase 1: AppSheetClient Changes

1. Add `getTable()` to `AppSheetClientInterface` in `src/types/client.ts`
2. Change `AppSheetClient` constructor to `(connectionDef: ConnectionDefinition, runAsUserEmail: string)`
3. Implement `getTable()` method in `AppSheetClient`
4. Change `MockAppSheetClient` constructor to `(connectionDef: ConnectionDefinition, runAsUserEmail: string)`
5. Implement `getTable()` method in `MockAppSheetClient`
6. Update tests for both clients

### Phase 2: New Factory Interfaces and Classes

1. Create `AppSheetClientFactoryInterface` in `src/types/client.ts`
2. Create `AppSheetClientFactory` in `src/client/AppSheetClientFactory.ts`
3. Create `MockAppSheetClientFactory` in `src/client/MockAppSheetClientFactory.ts`
4. Create `DynamicTableFactoryInterface` in `src/types/client.ts`
5. Create `DynamicTableFactory` in `src/client/DynamicTableFactory.ts`
6. Add unit tests for all factories

### Phase 3: ConnectionManager Redesign

1. Replace constructor with `(clientFactory, schema)` parameters
2. Replace `get()` with `get(connectionName: string, runAsUserEmail: string)`
3. Add `getSchema()` method
4. Remove all other methods (`register`, `has`, `remove`, `list`, `clear`, `ping`, `healthCheck`)
5. Update unit tests

### Phase 4: SchemaManager Changes

1. Change constructor to accept `(connectionManager, tableFactory)`
2. **Remove `initialize()` method** - DI handles everything
3. Delegate `table()` to `tableFactory.create()`
4. Make `runAsUserEmail` on `table()` **required** (was optional)
5. Update unit tests

### Phase 5: Cleanup

1. Remove `ConnectionConfig` type
2. Update exports in `src/index.ts`

### Phase 6: Documentation

1. Update CLAUDE.md with new APIs
2. Create MIGRATION.md for v2.x → v3.0.0
3. Update README with DI/testing examples

### Phase 7: Release

1. Update package.json version to 3.0.0
2. Update CHANGELOG.md
3. Tag release

## Files to Modify

### Source Files

1. `src/types/client.ts` - Add `AppSheetClientFactoryInterface`, `DynamicTableFactoryInterface`, add `getTable()` to `AppSheetClientInterface`
2. `src/client/AppSheetClient.ts` - **CHANGED** New constructor `(connectionDef, runAsUserEmail)`, add `getTable()` method
3. `src/client/MockAppSheetClient.ts` - **CHANGED** New constructor `(connectionDef, runAsUserEmail)`, add `getTable()` method
4. `src/client/AppSheetClientFactory.ts` - **NEW** Real client factory implementation
5. `src/client/MockAppSheetClientFactory.ts` - **NEW** Mock client factory implementation
6. `src/client/DynamicTableFactory.ts` - **NEW** Table factory implementation
7. `src/utils/ConnectionManager.ts` - Complete redesign (factory + schema injection)
8. `src/utils/SchemaManager.ts` - Constructor takes (connectionManager, tableFactory)
9. `src/types/index.ts` - Remove `ConnectionConfig`, export new types
10. `src/index.ts` - Export new classes

### Test Files

11. `tests/client/AppSheetClient.test.ts` - Update tests for new constructor and `getTable()` method
12. `tests/client/MockAppSheetClient.test.ts` - Update tests for new constructor and `getTable()` method
13. `tests/client/AppSheetClientFactory.test.ts` - **NEW** Client factory tests
14. `tests/client/MockAppSheetClientFactory.test.ts` - **NEW** Mock client factory tests
15. `tests/client/DynamicTableFactory.test.ts` - **NEW** Table factory tests
16. `tests/utils/ConnectionManager.test.ts` - Update tests
17. `tests/utils/SchemaManager.test.ts` - Update tests

### Documentation

18. `CLAUDE.md` - Document new APIs
19. `MIGRATION.md` - Create v2.x → v3.0.0 migration guide
20. `package.json` - Bump to 3.0.0
21. `CHANGELOG.md` - Document breaking changes

## Related Issues

- GitHub Issue: https://github.com/techdivision/appsheet/issues/6
- JIRA Ticket: SOSO-249
- Extends: SOSO-248 (Per-request user context - now works with DI!)
