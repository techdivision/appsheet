# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- AppSheetClient with full CRUD operations
- MockAppSheetClient for testing
- Schema-based usage with SchemaLoader and SchemaManager
- DynamicTable with runtime validation
- CLI tool for schema generation (inspect, init, add-table, validate)
- Multi-instance connection management
- runAsUserEmail feature for user context
- Comprehensive JSDoc documentation
- Jest test suite (48 tests)
- GitHub Actions CI workflow
- Semantic versioning setup

### Documentation
- README.md with usage examples
- CONTRIBUTING.md with versioning guidelines
- CLAUDE.md for Claude Code integration
- TypeDoc API documentation
- Comprehensive test documentation

## [0.1.0] - 2025-11-14

### Added
- Initial release
- Basic AppSheet CRUD operations
- TypeScript support
- Schema management

---

## Version Format

- **[MAJOR.MINOR.PATCH]** - Released versions
- **[Unreleased]** - Upcoming changes not yet released

## Change Categories

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

## Examples

### Patch Release (0.1.0 → 0.1.1)

```markdown
## [0.1.1] - 2025-11-15

### Fixed
- Fixed selector parsing for date fields
- Corrected error handling in retry logic

### Documentation
- Updated API documentation
```

### Minor Release (0.1.0 → 0.2.0)

```markdown
## [0.2.0] - 2025-11-20

### Added
- New `findByIds()` method for batch retrieval
- Support for custom request headers
- Connection pooling support

### Changed
- Improved error messages with more context

### Deprecated
- `oldMethod()` will be removed in v1.0.0
```

### Major Release (0.2.0 → 1.0.0)

```markdown
## [1.0.0] - 2025-12-01

### Added
- Stable API release
- Full TypeScript type coverage

### Changed
- **BREAKING**: Client methods now return typed responses
- **BREAKING**: Renamed `findAll()` to `find()` with options

### Removed
- **BREAKING**: Removed deprecated `oldMethod()`

### Migration Guide

#### Client Method Changes

Before (0.x.x):
```typescript
const rows = await client.findAll('Users');
```

After (1.0.0):
```typescript
const result = await client.find({ tableName: 'Users' });
const rows = result.rows;
```
```

[Unreleased]: https://github.com/techdivision/appsheet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/techdivision/appsheet/releases/tag/v0.1.0
