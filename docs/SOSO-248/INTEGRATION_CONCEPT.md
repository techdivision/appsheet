# Per-Request User Context Support in DynamicTable API

## Overview
Enable user-specific operations in the DynamicTable API by extending the `ConnectionManager.get()` and `SchemaManager.table()` methods with an optional `runAsUserEmail` parameter, allowing each table client instance to execute operations in the context of a specific user without requiring per-operation configuration.

## Problem Statement

The current `DynamicTable` API lacks the ability to specify user context on a per-request basis. While the underlying `AppSheetClient` supports `runAsUserEmail` both globally (via constructor) and per-operation (via `properties.RunAsUserEmail`), this capability isn't accessible in the higher-level `DynamicTable` wrapper.

### Current Limitations

**1. Missing Per-Request User Context**
```typescript
// ❌ Not possible - DynamicTable has no way to specify user
const worklogsTable = db.table<Worklog>('worklog', 'worklogs');
const userRecords = await worklogsTable.findAll(); // Runs as default user
```

**2. Suboptimal Workarounds**

Users are forced to choose between three unsatisfactory approaches:

- **Use Low-Level API Directly** - Sacrifices type-safety and schema validation
  ```typescript
  const client = db.getConnectionManager().get('worklog');
  await client.find({
    tableName: 'extract_worklog',
    properties: { RunAsUserEmail: 'user@example.com' }
  });
  // ❌ No type safety, no schema validation, loses DynamicTable benefits
  ```

- **Create Separate SchemaManager per User** - Inefficient memory usage
  ```typescript
  const user1DB = new SchemaManager(schema); // Entire schema duplicated
  const user2DB = new SchemaManager(schema); // Entire schema duplicated again
  // ❌ High memory overhead, doesn't scale for multi-tenant scenarios
  ```

- **Execute All Operations as Default User** - Security risk
  ```typescript
  const table = db.table<Worklog>('worklog', 'worklogs');
  await table.findAll(); // All users see all data
  // ❌ Wrong for multi-user contexts, potential security issues
  ```

### Impact

This limitation blocks production adoption of the Schema Manager pattern in multi-tenant scenarios where:
- Different users need to query the same table with their own security context
- MCP servers handle requests from multiple authenticated users
- Permission-based data access must be enforced at the AppSheet level
- Audit trails need to track which user performed which operation

## Requirements

### 1. User-Specific Client Pattern

Create table clients that are bound to a specific user context from creation by passing an optional `runAsUserEmail` parameter:

```typescript
// Create user-specific table client
const userTable = db.table<Worklog>(
  'worklog',
  'worklogs',
  'user@example.com'  // Optional 3rd parameter
);

// All operations automatically run as that user
const userRecords = await userTable.findAll();
await userTable.add([{ date: '2025-11-24', hours: 8 }]);
```

### 2. Backward Compatibility

Existing code must continue to work without changes:

```typescript
// Existing usage still works (uses global runAsUserEmail if configured)
const table = db.table<Worklog>('worklog', 'worklogs');
await table.findAll();
```

### 3. Clean Architecture

- No per-operation options parameters in DynamicTable methods
- User context is inherent to the client instance
- Immutable client instances (user cannot be changed after creation)
- Type-safe API with full generic support

### 4. Multi-Tenant Server Support

Enable MCP servers to handle multiple users efficiently:

```typescript
// MCP server handling user requests
function handleUserRequest(userId: string) {
  const userEmail = getUserEmail(userId);
  const userTable = db.table<Worklog>('worklog', 'worklogs', userEmail);
  return userTable.findAll(); // Runs as authenticated user
}
```

## Proposed Solution

### Architecture: Extended get() and table() Methods with Optional User Context

Instead of adding options parameters to every method, we extend the existing `ConnectionManager.get()` and `SchemaManager.table()` methods with an optional `runAsUserEmail` parameter. When provided, these methods create client instances bound to that specific user.

#### Key Design Principles

1. **User Context at Connection Level**: User-specific clients are created on-the-fly by ConnectionManager
2. **Immutable Clients**: Once created, a client's user context cannot be changed
3. **No Caching Needed**: User-specific clients are lightweight and created on-demand
4. **Backward Compatible**: Optional parameter - existing code works unchanged
5. **Layered Approach**: ConnectionManager creates user clients, SchemaManager passes through the parameter
6. **Minimal Changes**: Only extend two existing methods, no new APIs

### Implementation Design

#### 1. ConnectionManager Extension

```typescript
export class ConnectionManager {
  private connections = new Map<string, AppSheetClient>();

  /**
   * Get a registered client by name, optionally for a specific user.
   *
   * When runAsUserEmail is provided, creates a new AppSheetClient instance
   * configured for that user. The user-specific client is created on-the-fly
   * and not cached (lightweight operation).
   *
   * When runAsUserEmail is not provided, returns the default registered client.
   *
   * @param name - The unique name of the connection to retrieve
   * @param runAsUserEmail - Optional: Email of the user to execute operations as
   * @returns The AppSheetClient instance for the specified connection
   * @throws {Error} If no connection with the given name exists
   *
   * @example
   * ```typescript
   * // Default behavior (existing code, backward compatible)
   * const client = manager.get('worklog');
   * const records = await client.findAll('worklogs');
   *
   * // User-specific behavior (new)
   * const userClient = manager.get('worklog', 'user@example.com');
   * const userRecords = await userClient.findAll('worklogs');
   * ```
   */
  get(name: string, runAsUserEmail?: string): AppSheetClient {
    const baseClient = this.connections.get(name);
    if (!baseClient) {
      const available = [...this.connections.keys()].join(', ') || 'none';
      throw new Error(
        `Connection "${name}" not found. Available connections: ${available}`
      );
    }

    // No user specified - return default client (backward compatible)
    if (!runAsUserEmail) {
      return baseClient;
    }

    // User specified - create user-specific client on-the-fly
    const config = baseClient.getConfig();
    return new AppSheetClient({
      appId: config.appId,
      applicationAccessKey: config.applicationAccessKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      runAsUserEmail, // Override with user-specific email
    });
  }
}
```

#### 2. SchemaManager Extension

```typescript
export class SchemaManager {
  private schema: SchemaConfig;
  private connectionManager: ConnectionManager;

  constructor(schema: SchemaConfig) {
    // Validate schema
    const validation = SchemaLoader.validate(schema);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid schema: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    this.schema = schema;
    this.connectionManager = new ConnectionManager();
    this.initialize();
  }

  /**
   * Initialize all connections.
   *
   * Simplified: Only registers connections in ConnectionManager.
   * Table clients are now created on-the-fly, not cached.
   */
  private initialize(): void {
    for (const [connName, connDef] of Object.entries(this.schema.connections)) {
      // Register connection in ConnectionManager
      this.connectionManager.register({
        name: connName,
        appId: connDef.appId,
        applicationAccessKey: connDef.applicationAccessKey,
        baseUrl: connDef.baseUrl,
        timeout: connDef.timeout,
        retryAttempts: connDef.retryAttempts,
        runAsUserEmail: connDef.runAsUserEmail, // Global default if configured
      });

      // No longer pre-creating table clients - created on-demand instead
    }
  }

  /**
   * Get a table client with optional user context.
   *
   * Creates a DynamicTable instance on-the-fly using a client from the
   * ConnectionManager. When runAsUserEmail is provided, the ConnectionManager
   * creates a user-specific client.
   *
   * @template T - Type interface for the table rows
   * @param connectionName - The name of the connection containing the table
   * @param tableName - The name of the table as defined in the schema
   * @param runAsUserEmail - Optional: Email of the user to execute operations as
   * @returns A DynamicTable instance for performing operations on the table
   * @throws {Error} If the connection or table doesn't exist
   *
   * @example
   * ```typescript
   * // Default behavior (existing code, backward compatible)
   * const table = db.table<Worklog>('worklog', 'worklogs');
   * await table.findAll(); // Uses global runAsUserEmail from schema
   *
   * // User-specific behavior (new)
   * const userTable = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');
   * await userTable.findAll(); // Runs as specific user
   * ```
   */
  table<T = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail?: string
  ): DynamicTable<T> {
    // Get table definition
    const connection = this.schema.connections[connectionName];
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    const tableDef = connection.tables[tableName];
    if (!tableDef) {
      const available = Object.keys(connection.tables).join(', ');
      throw new Error(
        `Table "${tableName}" not found in connection "${connectionName}". ` +
          `Available tables: ${available}`
      );
    }

    // Get client from ConnectionManager (default or user-specific)
    const client = this.connectionManager.get(connectionName, runAsUserEmail);

    // Create and return DynamicTable on-the-fly
    return new DynamicTable<T>(client, tableDef);
  }
}
```

#### 3. DynamicTable (No Changes Required)

The `DynamicTable` class requires **no changes**. It already accepts an `AppSheetClient` in its constructor and uses that client for all operations. The user context is inherent in the client instance it receives.

```typescript
export class DynamicTable<T = Record<string, any>> {
  constructor(
    private client: AppSheetClient,  // Already user-specific
    private definition: TableDefinition
  ) {}

  async findAll(): Promise<T[]> {
    // Uses this.client which already has runAsUserEmail configured
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
    });
    return result.rows;
  }

  // ... other methods unchanged
}
```

#### 4. AppSheetClient (Already Supports This)

The `AppSheetClient` already supports global `runAsUserEmail` configuration, which is exactly what we need:

```typescript
export class AppSheetClient implements AppSheetClientInterface {
  constructor(config: AppSheetConfig) {
    this.config = {
      baseUrl: 'https://api.appsheet.com/api/v2',
      timeout: 30000,
      retryAttempts: 3,
      ...config,
      // runAsUserEmail is already supported here
    };
  }

  private mergeProperties(operationProperties?: RequestProperties): RequestProperties {
    const properties: RequestProperties = {};

    // Already injects runAsUserEmail if configured
    if (this.config.runAsUserEmail) {
      properties.RunAsUserEmail = this.config.runAsUserEmail;
    }

    // Operation-specific properties can still override
    if (operationProperties) {
      Object.assign(properties, operationProperties);
    }

    return properties;
  }
}
```

### Usage Examples

#### 1. MCP Server Multi-User Pattern

```typescript
import { SchemaLoader, SchemaManager } from '@techdivision/appsheet';

// Load schema once at server startup
const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
const db = new SchemaManager(schema);

// MCP tool handler
async function getMyWorklogs(userId: string) {
  const userEmail = getUserEmailFromId(userId);

  // Get user-specific table client with 3rd parameter
  const worklogsTable = db.table<Worklog>(
    'worklog',
    'worklogs',
    userEmail  // Optional 3rd parameter
  );

  // All operations run as authenticated user
  return await worklogsTable.findAll();
}

async function addWorklog(userId: string, worklog: Partial<Worklog>) {
  const userEmail = getUserEmailFromId(userId);

  // Create user-specific client
  const worklogsTable = db.table<Worklog>(
    'worklog',
    'worklogs',
    userEmail  // Optional 3rd parameter
  );

  // Operation runs as user (for permissions and audit trail)
  return await worklogsTable.add([worklog]);
}
```

#### 2. Different Users, Same Table

```typescript
// Admin operations
const adminTable = db.table<User>(
  'hr',
  'users',
  'admin@company.com'  // Optional 3rd parameter
);
const allUsers = await adminTable.findAll(); // Admin sees all

// Regular user operations
const userTable = db.table<User>(
  'hr',
  'users',
  'employee@company.com'  // Optional 3rd parameter
);
const myProfile = await userTable.findOne('[Email] = "employee@company.com"');
// User only sees what they have permission to see
```

#### 3. Backward Compatibility

```typescript
// OLD CODE - Still works exactly as before (2 parameters)
const table = db.table<Worklog>('worklog', 'worklogs');
await table.findAll(); // Uses global runAsUserEmail from schema

// NEW CODE - User-specific operations (3 parameters)
const userTable = db.table<Worklog>(
  'worklog',
  'worklogs',
  'user@example.com'  // Optional 3rd parameter
);
await userTable.findAll(); // Runs as specific user
```

#### 4. Client Caching and Reuse

```typescript
// First call - creates and caches client
const table1 = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');

// Second call - reuses cached client (same connection+table+user)
const table2 = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');

// table1 === table2 (same instance)

// Different user - creates new client
const table3 = db.table<Worklog>('worklog', 'worklogs', 'other@example.com');
// table3 !== table1 (different instance with different user context)

// No user specified - uses default client (separate cache)
const defaultTable = db.table<Worklog>('worklog', 'worklogs');
// defaultTable !== table1 (different cache, uses global runAsUserEmail)
```

## Implementation Plan

### Phase 1: Core Implementation
1. Extend `ConnectionManager.get()` method signature with optional `runAsUserEmail` parameter
2. Implement on-the-fly user-specific client creation in `ConnectionManager.get()`
3. Extend `SchemaManager.table()` method signature with optional `runAsUserEmail` parameter
4. Pass `runAsUserEmail` through from SchemaManager to ConnectionManager
5. Update TypeDoc comments with examples

### Phase 2: Testing
1. Unit tests for `ConnectionManager.get()` with optional 2nd parameter
2. Unit tests for `SchemaManager.table()` with optional 3rd parameter
3. Test user isolation (different users get different clients)
4. Test backward compatibility (existing calls work unchanged)
5. Test that user-specific clients are created on-the-fly (not cached)
6. Integration tests with real AppSheet operations

### Phase 3: Documentation
1. Update CLAUDE.md with new pattern
2. Add usage examples to README
3. Document MCP server pattern
4. Add migration guide section

### Phase 4: Schema Configuration Enhancement (Optional)
1. Allow per-connection default `runAsUserEmail` in schema:
   ```yaml
   connections:
     worklog:
       appId: ${WORKLOG_APP_ID}
       applicationAccessKey: ${WORKLOG_KEY}
       runAsUserEmail: default@example.com  # Optional default
   ```
2. Priority: operation override > tableForUser > connection default > none

## Success Criteria

1. ✅ `ConnectionManager.get()` accepts optional 2nd parameter for user-specific clients
2. ✅ `SchemaManager.table()` accepts optional 3rd parameter for user-specific clients
3. ✅ All DynamicTable operations run in user context automatically
4. ✅ User-specific clients are created on-the-fly (lightweight, no caching needed)
5. ✅ Existing calls work without changes (backward compatible)
6. ✅ MCP servers can handle multi-user scenarios efficiently
7. ✅ No performance degradation vs. existing implementation
8. ✅ Comprehensive test coverage (>90%)
9. ✅ Documentation complete with examples
10. ✅ Clean layered architecture (ConnectionManager → SchemaManager → DynamicTable)

## Technical Considerations

### Memory Management

**No Caching**: Both default and user-specific clients are created on-the-fly (not cached). AppSheetClient and DynamicTable instances are lightweight, so creating them per-request has minimal overhead.

**Memory Usage**: Only base AppSheetClient instances are stored in ConnectionManager (one per connection). All DynamicTable instances are created and garbage-collected per-request.

**Simplicity**: No complex cache management needed - just straightforward client and table creation on-demand.

### Performance

**Minimal Overhead**: Creating both AppSheetClient and DynamicTable instances is very lightweight (just object instantiation, no I/O).

**On-Demand Creation**: Clients and tables are created only when needed, avoiding memory overhead of pre-caching.

**No Performance Impact**: Object creation is < 1ms, negligible compared to actual API calls (100-500ms).

### Security

**User Isolation**: Each user gets their own client instance, preventing accidental data leakage between users.

**AppSheet Security**: User context is passed to AppSheet API, allowing AppSheet to enforce row-level security based on `RunAsUserEmail`.

**Immutable Context**: Once created, a client's user context cannot be changed, preventing context confusion.

### Thread Safety

**Stateless Clients**: AppSheetClient instances are stateless (no mutable state between operations), making them safe for concurrent use.

**Immutable Config**: Client configuration is immutable after construction.

**No Shared State**: Each user gets their own client instance, avoiding shared state issues.

## Alternative Approaches Considered

### ❌ Approach 1: Per-Operation Options Parameter

```typescript
// Rejected approach
await table.findAll({ runAsUserEmail: 'user@example.com' });
await table.add([{ ... }], { runAsUserEmail: 'user@example.com' });
```

**Why Rejected**:
- Requires checking options in every DynamicTable method (9+ methods)
- Easy to forget to pass options, leading to bugs
- Verbose and repetitive in calling code
- Breaks clean API design (context should be part of client, not operation)

### ❌ Approach 2: Optional Parameter Only on SchemaManager.table()

```typescript
// Rejected - only extends SchemaManager.table()
const table = db.table('worklog', 'worklogs', 'user@example.com');

// But requires complex caching logic in SchemaManager
```

**Why Rejected**:
- Requires complex user-specific caching in SchemaManager
- Mixes concerns (SchemaManager handles both schema AND user management)
- Creates tight coupling between SchemaManager and user context
- Doesn't leverage existing ConnectionManager architecture

### ❌ Approach 3: Separate User-Scoped SchemaManager

```typescript
// Rejected approach
const userDB = db.forUser('user@example.com');
const table = userDB.table('worklog', 'worklogs');
```

**Why Rejected**:
- More complex implementation (need to track user at manager level)
- Less flexible (what if one user needs multiple tables?)
- Unclear ownership semantics (does userDB share state with db?)
- Not significantly better than accepted approach

### ✅ Accepted Approach: Optional Parameters on ConnectionManager.get() + SchemaManager.table()

```typescript
// ConnectionManager level (new)
const client = connectionManager.get('worklog', 'user@example.com');

// SchemaManager level (passes through to ConnectionManager)
const table = db.table('worklog', 'worklogs', 'user@example.com');
await table.findAll(); // Automatically uses user context
```

**Why Accepted**:
- **Layered Architecture**: User context handled at connection level (where it belongs)
- **Separation of Concerns**: ConnectionManager manages clients, SchemaManager manages schema
- **No Caching Complexity**: On-the-fly client creation is simple and performant
- **100% Backward Compatible**: Optional parameters, existing code works unchanged
- **Minimal Changes**: Extend two existing methods, no new classes or APIs
- **Clean Implementation**: Each layer does one thing well
- **Leverages Existing Design**: Uses ConnectionManager's client factory pattern
- **Simple to Understand**: Clear flow from SchemaManager → ConnectionManager → AppSheetClient

## Breaking Changes

**None**. This is a purely additive change:
- `ConnectionManager.get()` signature extended with optional parameter
- `SchemaManager.table()` signature extended with optional parameter
- All existing calls work exactly as before
- Existing DynamicTable API unchanged
- Existing AppSheetClient API unchanged
- No changes to schema format

## Files to Modify

1. `src/utils/ConnectionManager.ts` - Extend `get()` method with optional `runAsUserEmail` parameter
2. `src/utils/SchemaManager.ts` - Extend `table()` method with optional `runAsUserEmail` parameter
3. `tests/utils/ConnectionManager.test.ts` - Add tests for 2-parameter usage
4. `tests/utils/SchemaManager.test.ts` - Add tests for 3-parameter usage
5. `CLAUDE.md` - Document optional parameters
6. `README.md` - Add usage examples

## Estimated Effort

- Core Implementation: 2 hours (extend two methods, very clean)
- Testing: 3 hours (test both layers)
- Documentation: 2 hours
- **Total: ~7 hours (1 day)**

## Related Issues

- GitHub Issue: https://github.com/techdivision/appsheet/issues/3
- JIRA Ticket: SOSO-248

## References

- Current SchemaManager implementation: `src/utils/SchemaManager.ts`
- AppSheetClient configuration: `src/client/AppSheetClient.ts:80-98`
- DynamicTable constructor: `src/client/DynamicTable.ts:35-38`
