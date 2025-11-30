# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a generic TypeScript library for AppSheet CRUD operations, designed for building MCP servers and internal tools. The library provides two usage patterns:
1. **Direct client usage** - Simple AppSheetClient for basic operations
2. **Schema-based usage** - Runtime schema loading from YAML/JSON with type-safe table clients and validation

## Git-Flow Branch Strategy ⚠️ WICHTIG

**KRITISCH:** Dieses Projekt folgt einer klassischen Git-Flow Strategie:

```
develop → CI only (keine Deployments)
staging → Staging Deployment (Pre-Production)
main    → Production Deployment
```

### Branch Rules

| Branch    | CI | Deploy | Purpose |
|-----------|-----|--------|---------|
| `develop` | ✅  | ❌     | Feature integration (CI only) |
| `staging` | ✅  | ✅     | Pre-production testing |
| `main`    | ✅  | ✅     | Production releases |

### Feature Development Flow

```bash
# 1. Create feature from develop
git checkout develop
git checkout -b feature/new-feature

# 2. Create PR: feature/new-feature → develop (CI runs)
# 3. Merge: develop → staging (auto-deploys to staging)
# 4. Merge: staging → main (auto-deploys to production)
```

### Branch Protection

- **develop**: 1 reviewer, CI required, no deploy
- **staging**: 1 reviewer, CI required, auto-deploy
- **main**: 2 reviewers, CI required, auto-deploy

**Siehe:** [.github/GIT-FLOW.md](.github/GIT-FLOW.md) und [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

## Development Commands

```bash
# Build
npm run build              # Compile TypeScript to dist/
npm run build:watch        # Watch mode compilation
npm run clean              # Remove dist/ directory

# Testing
npm test                   # Run all Jest tests
npm test:watch             # Watch mode testing
npm test -- <pattern>      # Run tests matching pattern (e.g., npm test -- AppSheetClient)
npx jest <file>            # Run specific test file (e.g., npx jest tests/client/AppSheetClient.test.ts)

# Code Quality
npm run lint               # Check for linting errors
npm run lint:fix           # Auto-fix linting errors
npm run format             # Format code with Prettier

# Documentation
npm run docs               # Generate API docs with TypeDoc
npm run docs:serve         # Generate and serve docs locally

# CLI Testing (after build)
node dist/cli/index.js inspect --help
npx appsheet inspect --help  # After npm install (uses bin entry)
```

## Architecture

### Core Components

**AppSheetClient** (`src/client/AppSheetClient.ts`)
- Main API client with CRUD methods (add, find, update, delete)
- Handles authentication, retries with exponential backoff, and error conversion
- Base URL: `https://api.appsheet.com/api/v2`
- **v3.0.0 Constructor**: `new AppSheetClient(connectionDef, runAsUserEmail)`
  - `connectionDef`: Full ConnectionDefinition with appId, applicationAccessKey, and tables
  - `runAsUserEmail`: Email of user to execute all operations as (required)
- **`getTable(tableName)`**: Returns TableDefinition for a table in the connection
- **Response Handling**: Automatically handles both AppSheet API response formats:
  - Standard format: `{ Rows: [...], Warnings?: [...] }`
  - Direct array format: `[...]` (automatically converted to standard format)

**AppSheetClientInterface** (`src/types/client.ts`)
- Interface defining the contract for all client implementations
- Implemented by both AppSheetClient and MockAppSheetClient
- Ensures type safety and allows swapping implementations in tests

**DynamicTable** (`src/client/DynamicTable.ts`)
- Schema-aware table client with comprehensive AppSheet field type validation
- Validates all 27 AppSheet field types (Email, URL, Phone, Enum, EnumList, etc.)
- Format validation (email addresses, URLs, phone numbers, dates, percentages)
- Required field validation and enum value constraints
- Created by SchemaManager, not instantiated directly

**Validators** (`src/utils/validators/`)
- **BaseTypeValidator**: JavaScript primitive type validation (string, number, boolean, array)
- **FormatValidator**: Format-specific validation (Email, URL, Phone, Date, DateTime, Percent)
- **AppSheetTypeValidator**: Main orchestrator for AppSheet field type validation
- Modular, reusable validation logic across the codebase

**SchemaLoader** (`src/utils/SchemaLoader.ts`)
- Loads schema from YAML/JSON files
- Resolves environment variables with `${VAR_NAME}` syntax
- Validates schema structure before use

**SchemaManager** (`src/utils/SchemaManager.ts`)
- Central management class using factory injection (v3.0.0)
- **v3.0.0 Constructor**: `new SchemaManager(clientFactory, schema)`
  - `clientFactory`: AppSheetClientFactoryInterface (use AppSheetClientFactory or MockAppSheetClientFactory)
  - `schema`: SchemaConfig from SchemaLoader
- **`table<T>(connection, tableName, runAsUserEmail)`**: Creates DynamicTable instances on-the-fly
  - `runAsUserEmail` is required in v3.0.0 (not optional)
  - Each call creates a new client instance (lightweight operation)
- **`getTableDefinition(connection, tableName)`**: Returns TableDefinition or undefined
- **`getFieldDefinition(connection, tableName, fieldName)`**: Returns FieldDefinition or undefined
- **`getAllowedValues(connection, tableName, fieldName)`**: Returns allowed values for Enum/EnumList fields
- Entry point for schema-based usage pattern

**ConnectionManager** (`src/utils/ConnectionManager.ts`)
- Simplified in v3.0.0 to use factory injection
- **v3.0.0 Constructor**: `new ConnectionManager(clientFactory, schema)`
  - `clientFactory`: AppSheetClientFactoryInterface
  - `schema`: SchemaConfig containing connection definitions
- **`get(connectionName, runAsUserEmail)`**: Creates client instances on-demand
  - Both parameters are required (no default/optional user)
- **`list()`**: Returns array of connection names
- **`has(connectionName)`**: Checks if connection exists

**Factory Classes** (v3.0.0)
- **AppSheetClientFactory**: Creates real AppSheetClient instances
- **MockAppSheetClientFactory**: Creates MockAppSheetClient instances for testing
- **DynamicTableFactory**: Creates DynamicTable instances from schema

### CLI Tool

**SchemaInspector** (`src/cli/SchemaInspector.ts`)
- Introspects AppSheet tables by analyzing up to 100 rows
- Automatically detects all 27 AppSheet field types from actual data
- Smart Enum detection: Identifies enum fields based on unique value ratio
- Extracts `allowedValues` for Enum/EnumList fields automatically
- Pattern detection for Email, URL, Phone, Date, DateTime, Percent
- Guesses key fields (looks for: id, key, ID, Key, _RowNumber)
- Converts table names to schema names (e.g., "extract_user" → "users")

**CLI Commands** (`src/cli/commands.ts`)
- `init` - Create empty schema file
- `inspect` - Generate schema from AppSheet app
  - With `--tables` flag: Generate schema for specific tables
  - Without `--tables` flag: Auto-discovery mode (prompts user to select tables interactively)
- `add-table` - Add single table to existing schema
- `validate` - Validate schema file structure

CLI binary name: `appsheet` (defined in package.json bin field)

## Key Design Patterns

### Schema Structure (v2.0.0)
```yaml
connections:
  <connection-name>:
    appId: ${ENV_VAR}
    applicationAccessKey: ${ENV_VAR}
    runAsUserEmail: user@example.com  # Optional: global user for all operations
    tables:
      <schema-table-name>:
        tableName: <actual-appsheet-table-name>
        keyField: <primary-key-field>
        fields:
          <field-name>:
            type: <AppSheetFieldType>  # Required: Text, Email, Number, Enum, etc.
            required: <boolean>        # Optional: default false
            allowedValues: [...]       # Optional: for Enum/EnumList
            description: <string>      # Optional
```

**AppSheet Field Types (27 total):**
- **Core**: Text, Number, Date, DateTime, Time, Duration, YesNo
- **Specialized Text**: Name, Email, URL, Phone, Address
- **Specialized Numbers**: Decimal, Percent, Price
- **Selection**: Enum, EnumList
- **Media**: Image, File, Drawing, Signature
- **Tracking**: ChangeCounter, ChangeTimestamp, ChangeLocation
- **References**: Ref, RefList
- **Special**: Color, Show

### Two Usage Patterns (v3.0.0)

**Pattern 1: Direct Client**
```typescript
const connectionDef: ConnectionDefinition = {
  appId: 'app-id',
  applicationAccessKey: 'access-key',
  tables: {
    users: { tableName: 'extract_user', keyField: 'id', fields: {...} }
  }
};
const client = new AppSheetClient(connectionDef, 'user@example.com');
await client.findAll('extract_user');
```

**Pattern 2: Schema-Based with Factory Injection** (Recommended)
```typescript
import {
  SchemaLoader,
  SchemaManager,
  AppSheetClientFactory
} from '@techdivision/appsheet';

// Production setup
const clientFactory = new AppSheetClientFactory();
const schema = SchemaLoader.fromYaml('./config/schema.yaml');
const db = new SchemaManager(clientFactory, schema);

// Get table for user (runAsUserEmail is required in v3.0.0)
const table = db.table<Type>('connection', 'tableName', 'user@example.com');
await table.findAll();  // Executes as user@example.com
```

**Pattern 3: Testing with Mock Factory**
```typescript
import {
  MockAppSheetClientFactory,
  SchemaManager,
  MockDataProvider
} from '@techdivision/appsheet';

// Test setup with mock factory
const testData: MockDataProvider = {
  getTables: () => new Map([
    ['extract_user', { rows: [...], keyField: 'id' }]
  ])
};
const mockFactory = new MockAppSheetClientFactory(testData);
const db = new SchemaManager(mockFactory, schema);

// Test operations without hitting real API
const table = db.table('worklog', 'users', 'test@example.com');
const users = await table.findAll();  // Returns seeded test data
```

**Pattern 4: Multi-Tenant MCP Server**
```typescript
// Single SchemaManager instance for entire server
const clientFactory = new AppSheetClientFactory();
const db = new SchemaManager(clientFactory, SchemaLoader.fromYaml('./schema.yaml'));

// MCP tool handler with per-request user context
server.tool('list_worklogs', async (params, context) => {
  // Extract user from MCP context
  const userEmail = context.user?.email;

  // Create user-specific table client (lightweight, on-demand)
  const table = db.table('worklog', 'worklogs', userEmail);

  // All operations execute with user's AppSheet permissions
  return await table.findAll();
});
```

### Schema Introspection (v3.0.0)

Access schema metadata directly without navigating nested structures:

```typescript
// Get table definition
const tableDef = db.getTableDefinition('default', 'service_portfolio');
// → { tableName: 'service_portfolio', keyField: 'id', fields: {...} }

// Get field definition
const statusField = db.getFieldDefinition('default', 'service_portfolio', 'status');
// → { type: 'Enum', allowedValues: ['Active', 'Inactive'], required: true }

// Get allowed values for Enum field (shortcut)
const statusValues = db.getAllowedValues('default', 'service_portfolio', 'status');
// → ['Active', 'Inactive', 'Pending']

// Use case: Generate Zod enum schema
const values = db.getAllowedValues('default', 'users', 'role');
if (values) {
  const roleEnum = z.enum(values as [string, ...string[]]);
}

// Use case: Populate UI dropdown
const options = db.getAllowedValues('default', 'users', 'status')?.map(v => ({
  label: v,
  value: v
}));
```

### Validation Examples

**Schema Definition with AppSheet Types:**
```yaml
fields:
  email:
    type: Email
    required: true
  status:
    type: Enum
    required: true
    allowedValues: ["Active", "Inactive", "Pending"]
  tags:
    type: EnumList
    allowedValues: ["JavaScript", "TypeScript", "React"]
  discount:
    type: Percent
    required: false
  website:
    type: URL
```

**Validation Errors:**
```typescript
// Invalid email format
await table.add([{ email: 'invalid' }]);
// ❌ ValidationError: Field "email" must be a valid email address

// Invalid enum value
await table.add([{ status: 'Unknown' }]);
// ❌ ValidationError: Field "status" must be one of: Active, Inactive, Pending

// Invalid percentage
await table.add([{ discount: 1.5 }]);
// ❌ ValidationError: Field "discount" must be between 0.00 and 1.00
```

### Factory Injection Pattern (v3.0.0)

**Feature**: Dependency injection via factory interfaces enables easy testing and flexible instantiation.

**Key Interfaces**:
- `AppSheetClientFactoryInterface`: Creates client instances
- `DynamicTableFactoryInterface`: Creates table instances

**Production vs Test**:
```typescript
// Production: Use AppSheetClientFactory
const prodFactory = new AppSheetClientFactory();
const prodDb = new SchemaManager(prodFactory, schema);

// Testing: Use MockAppSheetClientFactory
const testFactory = new MockAppSheetClientFactory(mockData);
const testDb = new SchemaManager(testFactory, schema);
```

**Benefits**:
- Easy unit testing without mocking complex dependencies
- No need to mock axios or network calls
- Test data can be pre-seeded via MockDataProvider
- Same code paths for production and test environments

### Error Handling

All errors extend `AppSheetError` with specific subtypes:
- `AuthenticationError` (401/403)
- `ValidationError` (400) - Now includes field-level validation errors
- `NotFoundError` (404)
- `RateLimitError` (429)
- `NetworkError` (no response)

Retry logic applies to network errors and 5xx server errors (max 3 attempts by default).

## AppSheet API Details

**Action Types**: Add, Find, Edit (not Update), Delete

**Selectors**: AppSheet filter expressions use bracket notation:
- `[FieldName] = "value"`
- `[Status] = "Active" AND [Date] > "2025-01-01"`

**Request Structure**:
```json
{
  "Action": "Find",
  "Properties": { "Locale": "de-DE", "Selector": "..." },
  "Rows": [...]
}
```

**Response Structure** (handled automatically by client):
```json
// Standard format
{
  "Rows": [...],
  "Warnings": [...]
}

// Alternative format (converted automatically)
[...]  // Direct array, converted to { Rows: [...], Warnings: [] }
```

**Note**: The AppSheet API may return responses in either format. The AppSheetClient automatically normalizes both formats to the standard `{ Rows: [...], Warnings?: [...] }` structure for consistent handling.

## Breaking Changes (v3.0.0)

**⚠️ IMPORTANT**: Version 3.0.0 introduces breaking changes. See MIGRATION.md for upgrade guide.

### v3.0.0 Breaking Changes

**AppSheetClient**:
- ❌ Old: `new AppSheetClient({ appId, applicationAccessKey, runAsUserEmail? })`
- ✅ New: `new AppSheetClient(connectionDef, runAsUserEmail)`
- ❌ `getConfig()` removed - use `getTable()` instead

**ConnectionManager**:
- ❌ Old: `new ConnectionManager()` + `register()` + `get(name, userEmail?)`
- ✅ New: `new ConnectionManager(clientFactory, schema)` + `get(name, userEmail)`
- ❌ `register()`, `remove()`, `clear()`, `ping()`, `healthCheck()` removed
- ✅ `list()` and `has()` added for introspection

**SchemaManager**:
- ❌ Old: `new SchemaManager(schema)` + `table(conn, table, userEmail?)`
- ✅ New: `new SchemaManager(clientFactory, schema)` + `table(conn, table, userEmail)`
- ❌ `getConnectionManager()` and `reload()` removed
- ✅ `hasConnection()` and `hasTable()` added

**MockAppSheetClient**:
- ❌ Old: `new MockAppSheetClient({ appId, applicationAccessKey })`
- ✅ New: `new MockAppSheetClient(connectionDef, runAsUserEmail, dataProvider?)`

### v3.0.0 Migration Example
```typescript
// ❌ Old (v2.x)
const client = new AppSheetClient({
  appId: 'app-id',
  applicationAccessKey: 'key',
  runAsUserEmail: 'user@example.com'
});
const db = new SchemaManager(schema);
const table = db.table('conn', 'tableName');  // optional user

// ✅ New (v3.0.0)
const connectionDef = { appId: 'app-id', applicationAccessKey: 'key', tables: {...} };
const client = new AppSheetClient(connectionDef, 'user@example.com');

const clientFactory = new AppSheetClientFactory();
const db = new SchemaManager(clientFactory, schema);
const table = db.table('conn', 'tableName', 'user@example.com');  // required user
```

## Breaking Changes (v2.0.0)

### v2.0.0 Schema Changes
- ❌ Old generic types (`'string'`, `'number'`, etc.) no longer supported
- ❌ Shorthand string format (`"email": "string"`) no longer supported
- ❌ `enum` property renamed to `allowedValues`
- ✅ All fields must use full FieldDefinition with `type` property
- ✅ Only AppSheet-specific types supported (Text, Email, Number, etc.)

## Documentation

All public APIs use TSDoc comments with:
- `@param` for parameters
- `@returns` for return values
- `@throws` for error conditions
- `@example` for usage examples
- `@category` for TypeDoc categorization

Categories: Client, Schema Management, Connection Management, Types, Errors

## File Organization

```
src/
├── client/          # AppSheetClient, DynamicTable
│   └── __mocks__/   # Mock implementations for testing
├── types/           # All TypeScript interfaces and types
├── utils/           # ConnectionManager, SchemaLoader, SchemaManager
├── cli/             # CLI commands and SchemaInspector
└── index.ts         # Main export file

tests/               # Test files (separate from source)
├── client/          # Client tests
│   └── AppSheetClient.test.ts
└── ...              # Tests mirror src/ structure

examples/            # Usage examples
docs/
├── TECHNICAL_CONCEPTION.md  # Complete design document (German)
└── api/             # Generated TypeDoc HTML (gitignored)
```

## Testing

### Factory-Based Testing (v3.0.0)

Use `MockAppSheetClientFactory` for testing without hitting the real AppSheet API:

```typescript
import {
  MockAppSheetClientFactory,
  SchemaManager,
  MockDataProvider,
  ConnectionDefinition
} from '@techdivision/appsheet';

// Define connection for direct client testing
const connectionDef: ConnectionDefinition = {
  appId: 'test-app',
  applicationAccessKey: 'test-key',
  tables: {
    users: { tableName: 'extract_user', keyField: 'id', fields: {...} }
  }
};

// Option 1: Direct MockAppSheetClient usage
const mockClient = new MockAppSheetClient(connectionDef, 'test@example.com');
await mockClient.addOne('extract_user', { id: '1', name: 'Test' });
const users = await mockClient.findAll('extract_user');

// Option 2: Factory injection with SchemaManager (recommended)
const mockFactory = new MockAppSheetClientFactory();
const db = new SchemaManager(mockFactory, schema);
const table = db.table('worklog', 'users', 'test@example.com');
await table.add([{ id: '1', name: 'Test' }]);

// Option 3: Pre-seeded test data via MockDataProvider
const testData: MockDataProvider = {
  getTables: () => new Map([
    ['extract_user', { rows: [{ id: '1', name: 'Alice' }], keyField: 'id' }]
  ])
};
const seededFactory = new MockAppSheetClientFactory(testData);
const seededDb = new SchemaManager(seededFactory, schema);
const table = seededDb.table('worklog', 'users', 'test@example.com');
const users = await table.findAll();  // Returns pre-seeded data
```

### MockAppSheetClient
- In-memory mock implementation of `AppSheetClientInterface`
- **v3.0.0 Constructor**: `new MockAppSheetClient(connectionDef, runAsUserEmail, dataProvider?)`
- Stores data in memory without making API calls
- Fully tested with comprehensive test suite

### Test Configuration
- Tests use Jest with ts-jest preset
- Test files located in `tests/` directory (separate from `src/`)
- Test structure mirrors `src/` directory structure
- Test files: `**/*.test.ts` or `**/*.spec.ts`
- Coverage configured to exclude type definitions and mock files
- Mock data available in `src/client/__mocks__/` directory
- Import paths from tests: `import { X } from '../../src/module/X'`

### Test Files
- `tests/client/AppSheetClient.test.ts` - Tests for real AppSheet client
- `tests/client/MockAppSheetClient.test.ts` - Tests for mock client implementation

## Important Notes

- The library uses AppSheet API v2
- CLI binary entry point: `dist/cli/index.js` (automatically made executable by npm)
- CLI binary command: `appsheet` (can be run via `npx appsheet` after installation)
- Schema files support environment variable substitution with `${VAR_NAME}` syntax
- SchemaInspector's `toSchemaName()` method removes "extract_" prefix and adds "s" suffix
- Multi-instance support allows one MCP server to access multiple AppSheet apps
- Runtime validation in DynamicTable checks types but doesn't prevent API calls for performance
- The library is designed to be installed from GitHub via npm (not published to npm registry yet)
