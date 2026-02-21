# Documentation

## API Documentation

The API documentation is auto-generated from TSDoc comments in the source code.

### Generate Documentation

```bash
npm run docs
```

This will generate HTML documentation in `docs/api/`.

### View Documentation Locally

```bash
npm run docs:serve
```

This will generate the documentation and serve it locally in your browser.

### Online Documentation

Once published, the documentation will be available at:

- NPM: https://www.npmjs.com/package/@techdivision/appsheet
- GitHub: https://github.com/techdivision/appsheet
- GitHub Pages: (if configured)

## Examples

See the `examples/` directory for usage examples:

- **`basic-usage.ts`** - Direct AppSheetClient usage with ConnectionDefinition (v3.1.0)
- **`schema-based-usage.ts`** - Schema-based usage with factory injection, multi-tenant pattern, and schema introspection (v3.1.0)
- **`selector-builder-usage.ts`** - SelectorBuilder for injection-safe filters, automatic wrapping, DI injection, and AOP extensibility (v3.1.0)
- **`config/example-schema.yaml`** - Example schema configuration with AppSheet field types (v2.0.0+ format)

## Concept Documents

Design decisions and implementation concepts for specific features:

- **`SOSO-365/BUGFIX_CONCEPT.md`** - SelectorBuilder, selector wrapping fix, default URL correction, DI compatibility (v3.1.0)
- **`SOSO-249/INTEGRATION_CONCEPT.md`** - Factory injection pattern for DI and testing (v3.0.0)
- **`SOSO-248/INTEGRATION_CONCEPT.md`** - Per-request user context (v2.1.0)
- **`SOSO-247/INTEGRATION_CONCEPT.md`** - AppSheet field type system and validation (v2.0.0)
- **`SOSO-246/`** - Initial DI/testing concept research (v3.0.0 planning)

## Archive

Historical planning documents that are no longer current:

- **`archive/TECHNICAL_CONCEPTION_v1.md`** - Original v1.0 design document. Contains planned features (FilterBuilder, BatchOperations, CachedAppSheetClient, Plugin-System, QueryBuilder) that were not implemented or replaced by other patterns. **Not representative of current implementation.**
