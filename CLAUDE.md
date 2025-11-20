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
- All operations require: appId, applicationAccessKey, tableName
- **User Configuration**: Optional global `runAsUserEmail` config automatically injected into all requests
  - Set globally in AppSheetClient constructor: `new AppSheetClient({ appId, applicationAccessKey, runAsUserEmail: 'user@example.com' })`
  - Per-operation override possible via `properties.RunAsUserEmail`
  - Required for operations that need user context (permissions, auditing, etc.)
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

## Breaking Changes (v2.0.0)

**⚠️ IMPORTANT**: Version 2.0.0 introduces breaking changes. See MIGRATION.md for upgrade guide.

### Removed Features
- ❌ Old generic types (`'string'`, `'number'`, `'boolean'`, `'date'`, `'array'`, `'object'`) are no longer supported
- ❌ Shorthand string format for field definitions (`"email": "string"`) is no longer supported
- ❌ `enum` property renamed to `allowedValues`

### New Requirements
- ✅ All fields must use full FieldDefinition object with `type` property
- ✅ Only AppSheet-specific types are supported (Text, Email, Number, etc.)
- ✅ Schema validation is stricter and more comprehensive

### Migration Example
```yaml
# ❌ Old schema (v1.x) - NO LONGER WORKS
fields:
  email: string
  age: number
  status:
    type: string
    enum: ["Active", "Inactive"]

# ✅ New schema (v2.0.0)
fields:
  email:
    type: Email
    required: true
  age:
    type: Number
    required: false
  status:
    type: Enum
    required: true
    allowedValues: ["Active", "Inactive"]
```

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

### MockAppSheetClient
For testing purposes, use `MockAppSheetClient` (`src/client/MockAppSheetClient.ts`):
- In-memory mock implementation of `AppSheetClientInterface`
- Implements the same interface as `AppSheetClient` for easy swapping in tests
- Stores data in memory without making API calls
- Useful for unit tests and local development
- Fully tested with comprehensive test suite

```typescript
import { MockAppSheetClient, AppSheetClientInterface } from '@techdivision/appsheet';

// Direct usage
const mockClient = new MockAppSheetClient({
  appId: 'mock-app',
  applicationAccessKey: 'mock-key'
});
await mockClient.addOne('Users', { id: '1', name: 'Test' });
const users = await mockClient.findAll('Users'); // Returns mock data

// Using interface for polymorphism
function processUsers(client: AppSheetClientInterface) {
  return client.findAll('Users');
}

// Works with both real and mock clients
const realClient = new AppSheetClient({ appId, applicationAccessKey });
const mockClient = new MockAppSheetClient({ appId, applicationAccessKey });

await processUsers(realClient); // Uses real API
await processUsers(mockClient); // Uses in-memory data
```

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
