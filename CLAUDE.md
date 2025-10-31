# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a generic TypeScript library for AppSheet CRUD operations, designed for building MCP servers and internal tools. The library provides two usage patterns:
1. **Direct client usage** - Simple AppSheetClient for basic operations
2. **Schema-based usage** - Runtime schema loading from YAML/JSON with type-safe table clients and validation

## Development Commands

```bash
# Build
npm run build              # Compile TypeScript to dist/
npm run build:watch        # Watch mode compilation
npm run clean              # Remove dist/ directory

# Testing
npm test                   # Run Jest tests
npm test:watch             # Watch mode testing

# Code Quality
npm run lint               # Check for linting errors
npm run lint:fix           # Auto-fix linting errors
npm run format             # Format code with Prettier

# Documentation
npm run docs               # Generate API docs with TypeDoc
npm run docs:serve         # Generate and serve docs locally

# CLI Testing (after build)
node dist/cli/index.js inspect --help
```

## Architecture

### Core Components

**AppSheetClient** (`src/client/AppSheetClient.ts`)
- Main API client with CRUD methods (add, find, update, delete)
- Handles authentication, retries with exponential backoff, and error conversion
- Base URL: `https://api.appsheet.com/api/v2`
- All operations require: appId, applicationAccessKey, tableName
- **User Configuration**: Optional global `runAsUserEmail` config automatically injected into all requests
  - Set globally in AppSheetClient constructor: `new AppSheetClient({ appId, applicationAccessKey, runAsUserEmail: 'user@example.com' })`
  - Per-operation override possible via `properties.RunAsUserEmail`
  - Required for operations that need user context (permissions, auditing, etc.)
- **Response Handling**: Automatically handles both AppSheet API response formats:
  - Standard format: `{ Rows: [...], Warnings?: [...] }`
  - Direct array format: `[...]` (automatically converted to standard format)

**DynamicTable** (`src/client/DynamicTable.ts`)
- Schema-aware table client with runtime validation
- Validates field types, required fields, and enum values based on TableDefinition
- Created by SchemaManager, not instantiated directly

**SchemaLoader** (`src/utils/SchemaLoader.ts`)
- Loads schema from YAML/JSON files
- Resolves environment variables with `${VAR_NAME}` syntax
- Validates schema structure before use

**SchemaManager** (`src/utils/SchemaManager.ts`)
- Central management class that:
  1. Validates loaded schema
  2. Initializes ConnectionManager with all connections
  3. Creates DynamicTable instances for each table
  4. Provides `table<T>(connection, tableName)` method
- Entry point for schema-based usage pattern

**ConnectionManager** (`src/utils/ConnectionManager.ts`)
- Manages multiple AppSheet app connections by name
- Enables multi-instance support (multiple apps in one project)
- Provides health check functionality

### CLI Tool

**SchemaInspector** (`src/cli/SchemaInspector.ts`)
- Introspects AppSheet tables by fetching sample data
- Infers field types from actual data
- Guesses key fields (looks for: id, key, ID, Key, _RowNumber)
- Converts table names to schema names (e.g., "extract_user" → "users")

**CLI Commands** (`src/cli/commands.ts`)
- `init` - Create empty schema file
- `inspect` - Generate schema from AppSheet app (with optional auto-discovery)
- `add-table` - Add single table to existing schema
- `validate` - Validate schema file structure

## Key Design Patterns

### Schema Structure
```yaml
connections:
  <connection-name>:
    appId: ${ENV_VAR}
    applicationAccessKey: ${ENV_VAR}
    runAsUserEmail: user@example.com  # Optional: global user for all operations in this connection
    tables:
      <schema-table-name>:
        tableName: <actual-appsheet-table-name>
        keyField: <primary-key-field>
        fields:
          <field-name>: <type>  # or full FieldDefinition object
```

### Two Usage Patterns

**Pattern 1: Direct Client**
```typescript
const client = new AppSheetClient({
  appId,
  applicationAccessKey,
  runAsUserEmail: 'user@example.com'  // Optional
});
await client.findAll('TableName');
```

**Pattern 2: Schema-Based** (Recommended)
```typescript
const schema = SchemaLoader.fromYaml('./config/schema.yaml');
const db = new SchemaManager(schema);
const table = db.table<Type>('connection', 'tableName');
await table.findAll();
```

### Error Handling

All errors extend `AppSheetError` with specific subtypes:
- `AuthenticationError` (401/403)
- `ValidationError` (400)
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
├── types/           # All TypeScript interfaces and types
├── utils/           # ConnectionManager, SchemaLoader, SchemaManager
├── cli/             # CLI commands and SchemaInspector
└── index.ts         # Main export file

examples/            # Usage examples
docs/
├── TECHNICAL_CONCEPTION.md  # Complete design document (German)
└── api/             # Generated TypeDoc HTML (gitignored)
```

## Important Notes

- The library uses AppSheet API v2
- CLI binary entry point: `dist/cli/index.js` (needs `chmod +x` after build)
- Schema files support environment variable substitution
- SchemaInspector's `toSchemaName()` method removes "extract_" prefix and adds "s" suffix
- Multi-instance support allows one MCP server to access multiple AppSheet apps
- Runtime validation in DynamicTable checks types but doesn't prevent API calls for performance
