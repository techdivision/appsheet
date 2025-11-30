# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2024-11-30

### Added

- **Factory Pattern for Dependency Injection** (SOSO-249)
  - `AppSheetClientFactory`: Creates real AppSheetClient instances
  - `MockAppSheetClientFactory`: Creates MockAppSheetClient instances for testing
  - `DynamicTableFactory`: Creates DynamicTable instances from schema
  - `AppSheetClientFactoryInterface`: Interface for custom factory implementations
  - `DynamicTableFactoryInterface`: Interface for custom table factory implementations

- **Enhanced Client Interface**
  - Added `getTable(tableName)` method to `AppSheetClientInterface`
  - Returns TableDefinition for tables in the connection
  - Enables DynamicTableFactory to create tables with proper definitions

- **SchemaManager Introspection Methods**
  - `hasConnection(connectionName)`: Check if connection exists
  - `hasTable(connectionName, tableName)`: Check if table exists in connection
  - `getTableDefinition(connectionName, tableName)`: Get TableDefinition or undefined ([#7](https://github.com/techdivision/appsheet/issues/7))
  - `getFieldDefinition(connectionName, tableName, fieldName)`: Get FieldDefinition or undefined ([#7](https://github.com/techdivision/appsheet/issues/7))
  - `getAllowedValues(connectionName, tableName, fieldName)`: Get allowed values for Enum/EnumList fields ([#7](https://github.com/techdivision/appsheet/issues/7))

- **ConnectionManager Introspection Methods**
  - `list()`: Returns array of all connection names
  - `has(connectionName)`: Checks if connection exists

### Changed

- **BREAKING**: `AppSheetClient` constructor signature changed
  - Old: `new AppSheetClient({ appId, applicationAccessKey, runAsUserEmail? })`
  - New: `new AppSheetClient(connectionDef, runAsUserEmail)`
  - `connectionDef` is a full `ConnectionDefinition` with tables
  - `runAsUserEmail` is required (not optional)

- **BREAKING**: `MockAppSheetClient` constructor signature changed
  - Old: `new MockAppSheetClient({ appId, applicationAccessKey })`
  - New: `new MockAppSheetClient(connectionDef, runAsUserEmail, dataProvider?)`

- **BREAKING**: `ConnectionManager` now uses factory injection
  - Old: `new ConnectionManager()` + `register()` + `get(name, userEmail?)`
  - New: `new ConnectionManager(clientFactory, schema)` + `get(name, userEmail)`
  - Both `connectionName` and `runAsUserEmail` are required in `get()`

- **BREAKING**: `SchemaManager` now uses factory injection
  - Old: `new SchemaManager(schema)` + `table(conn, table, userEmail?)`
  - New: `new SchemaManager(clientFactory, schema)` + `table(conn, table, userEmail)`
  - `runAsUserEmail` is required in `table()` (not optional)

- **BREAKING**: `DynamicTable` constructor uses interface
  - Now accepts `AppSheetClientInterface` instead of concrete `AppSheetClient`
  - Enables proper dependency injection and testing

### Removed

- **BREAKING**: `AppSheetClient.getConfig()` - use `getTable()` instead
- **BREAKING**: `ConnectionManager.register()` - constructor accepts schema directly
- **BREAKING**: `ConnectionManager.remove()` - connections defined by schema
- **BREAKING**: `ConnectionManager.clear()` - connections defined by schema
- **BREAKING**: `ConnectionManager.ping()` - removed health check
- **BREAKING**: `ConnectionManager.healthCheck()` - removed health check
- **BREAKING**: `SchemaManager.getConnectionManager()` - internal only
- **BREAKING**: `SchemaManager.reload()` - create new instance instead

### Deprecated

- `AppSheetConfig` interface - use `ConnectionDefinition` instead
- `ConnectionConfig` interface - use factory injection pattern instead

### Migration Guide

See [CLAUDE.md](./CLAUDE.md) Breaking Changes section for detailed migration examples.

**Quick Migration:**
```typescript
// Old (v2.x)
const client = new AppSheetClient({ appId, applicationAccessKey, runAsUserEmail });
const db = new SchemaManager(schema);
const table = db.table('conn', 'table');  // optional user

// New (v3.0.0)
const connectionDef = { appId, applicationAccessKey, tables: {...} };
const client = new AppSheetClient(connectionDef, runAsUserEmail);

const factory = new AppSheetClientFactory();
const db = new SchemaManager(factory, schema);
const table = db.table('conn', 'table', runAsUserEmail);  // required user
```

### Technical Details

- **SemVer Level**: MAJOR (breaking changes)
- **Test Coverage**: 221 tests across 8 test suites
- **Breaking Changes**: Constructor signatures, required parameters, removed methods

## [2.1.0] - 2024-11-24

### Added

- **Per-Request User Context Support** ([#3](https://github.com/techdivision/appsheet/issues/3))
  - Added optional `runAsUserEmail` parameter to `ConnectionManager.get()` method
  - Added optional `runAsUserEmail` parameter to `SchemaManager.table()` method
  - Enables multi-tenant MCP servers with per-request user context
  - User-specific clients are created on-the-fly (lightweight, no caching)
  - Overrides global `runAsUserEmail` from schema when provided
  - 100% backward compatible - existing code works without changes

- **Enhanced Schema Configuration**
  - Added optional `runAsUserEmail` field to `ConnectionDefinition` interface
  - Allows setting global default user at connection level in schema

- **Comprehensive Test Coverage**
  - Added 13 tests for `ConnectionManager` per-request user context
  - Added 18 tests for `SchemaManager` per-request user context
  - Total test suite: 157 tests across 6 test suites

- **Documentation Updates**
  - Added "Per-Request User Context" section to CLAUDE.md
  - Added "Multi-Tenant MCP Server" usage pattern
  - Updated component descriptions with new feature details
  - Added usage examples for ConnectionManager and SchemaManager

### Changed

- **SchemaManager Architecture**
  - Removed table client caching - `DynamicTable` instances now created on-the-fly
  - Simplified `initialize()` method - only registers connections (no table pre-creation)
  - Updated `getConnections()` and `getTables()` to work without cache
  - More efficient for per-request user context use cases

### Fixed

- Fixed package.json version number ([#4](https://github.com/techdivision/appsheet/issues/4))
  - Version corrected from `0.2.0` to `2.1.0` (proper SemVer)
  - Reflects actual major version 2.0.0 release with breaking changes

### Technical Details

- **Breaking Changes**: None (fully backward compatible)
- **SemVer Level**: MINOR (new features, no breaking changes)
- **Migration Required**: No
- **Dependencies**: Added `ts-semver-detector@^0.3.1` (dev dependency)

## [2.0.0] - 2024-11-20

### Added

- **AppSheet Field Type System** (SOSO-247)
  - Support for all 27 AppSheet-specific field types
  - Core types: Text, Number, Date, DateTime, Time, Duration, YesNo
  - Specialized text: Name, Email, URL, Phone, Address
  - Specialized numbers: Decimal, Percent, Price
  - Selection types: Enum, EnumList
  - Media types: Image, File, Drawing, Signature
  - Tracking types: ChangeCounter, ChangeTimestamp, ChangeLocation
  - Reference types: Ref, RefList
  - Special types: Color, Show

- **Enhanced Validation System**
  - Format validation for Email, URL, Phone fields
  - Range validation for Percent type (0.00 to 1.00)
  - Enum/EnumList value validation with `allowedValues`
  - Required field validation for add operations
  - Type-specific validation for all AppSheet types

- **Validator Architecture**
  - `BaseTypeValidator`: JavaScript primitive type validation
  - `FormatValidator`: Format-specific validation (Email, URL, Phone, Date, DateTime, Percent)
  - `AppSheetTypeValidator`: Main orchestrator for field type validation

- **SchemaInspector Enhancements**
  - Automatic detection of all 27 AppSheet field types from data
  - Smart Enum detection based on unique value ratio
  - Pattern detection for Email, URL, Phone, Date, DateTime, Percent
  - Automatic extraction of `allowedValues` for Enum/EnumList fields

### Changed

- **BREAKING**: Schema format now requires AppSheet-specific types
  - Old generic types (`string`, `number`, `boolean`, etc.) no longer supported
  - All fields must use full `FieldDefinition` object with `type` property
  - Shorthand string format (`"email": "string"`) removed
  - `enum` property renamed to `allowedValues`

- **BREAKING**: Type validation is stricter and more comprehensive
  - All field values validated against AppSheet type constraints
  - Format validation enforced for specialized types

### Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed upgrade instructions from v1.x to v2.0.0.

## [1.x.x] - Previous Releases

For changes in version 1.x.x, please refer to git history.

---

## Links

- [GitHub Repository](https://github.com/techdivision/appsheet)
- [Issue Tracker](https://github.com/techdivision/appsheet/issues)
- [Documentation](./CLAUDE.md)

## SemVer Policy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Breaking changes, incompatible API changes
- **MINOR** version: New features, backward-compatible additions
- **PATCH** version: Bug fixes, backward-compatible fixes
