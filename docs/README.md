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
- NPM: https://www.npmjs.com/package/@yourorg/appsheet
- GitHub Pages: (if configured)

## Technical Conception

See [TECHNICAL_CONCEPTION.md](./TECHNICAL_CONCEPTION.md) for the complete technical design document.

## Examples

See the `examples/` directory for usage examples:
- `basic-usage.ts` - Direct client usage
- `schema-based-usage.ts` - Schema-based usage with runtime loading
- `config/example-schema.yaml` - Example schema configuration file
