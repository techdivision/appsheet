# AppSheet TypeScript Library

A generic TypeScript library for AppSheet CRUD operations, designed for building MCP servers and internal tools.

## Features

- Full CRUD operations for AppSheet tables
- Runtime schema loading from YAML/JSON
- CLI tool for schema generation and management
- Type-safe API with TypeScript
- Multi-instance support (multiple AppSheet apps)
- Schema-based validation with 27 AppSheet field types
- Factory injection for dependency injection and testing (v3.0.0)
- Schema introspection methods (v3.0.0)

## Installation

### From GitHub (for internal projects)

Install directly from the GitHub repository:

```bash
npm install git+ssh://git@github.com:techdivision/appsheet.git
```

Or specify a specific branch or tag:

```bash
# Install from a specific branch
npm install git+ssh://git@github.com:techdivision/appsheet.git#main

# Install from a specific tag/version
npm install git+ssh://git@github.com:techdivision/appsheet.git#v0.1.0
```

Add to your `package.json`:

```json
{
  "dependencies": {
    "@techdivision/appsheet": "git+ssh://git@github.com:techdivision/appsheet.git"
  }
}
```

### From npm (when published)

```bash
npm install @techdivision/appsheet
```

## Quick Start

### 1. Generate Schema

Use the CLI to automatically generate schema from your AppSheet app:

```bash
# Generate schema for specific tables
npx appsheet inspect \
  --app-id "your-app-id" \
  --access-key "your-access-key" \
  --tables "worklog,issues,employees"

# Or let it discover tables automatically
npx appsheet inspect \
  --app-id "your-app-id" \
  --access-key "your-access-key"
```

This creates `config/appsheet-schema.yaml` with your table definitions.

### 2. Use in Your Code (v3.0.0)

```typescript
import {
  SchemaLoader,
  SchemaManager,
  AppSheetClientFactory
} from '@techdivision/appsheet';

// Load schema with factory injection (v3.0.0)
const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
const clientFactory = new AppSheetClientFactory();
const db = new SchemaManager(clientFactory, schema);

// Use type-safe table clients (runAsUserEmail required in v3.0.0)
interface Worklog {
  id: string;
  date: string;
  hours: number;
  description: string;
}

const worklogsTable = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');

// CRUD operations
const worklogs = await worklogsTable.findAll();
const today = await worklogsTable.find('[date] = "2025-10-27"');

await worklogsTable.add([
  { id: '123', date: '2025-10-27', hours: 8, description: 'Work done' }
]);

await worklogsTable.update([{ id: '123', hours: 7 }]);
await worklogsTable.delete([{ id: '123' }]);

// Schema introspection (v3.0.0)
const tableDef = db.getTableDefinition('worklog', 'worklogs');
const fieldDef = db.getFieldDefinition('worklog', 'worklogs', 'status');
const allowedValues = db.getAllowedValues('worklog', 'worklogs', 'status');
```

## CLI Commands

```bash
# Initialize empty schema
npx appsheet init

# Inspect and generate schema
npx appsheet inspect --app-id <id> --access-key <key> --tables <tables>

# Add a table to existing schema
npx appsheet add-table <connection> <tableName>

# Validate schema
npx appsheet validate
```

## Direct Client Usage (v3.0.0)

For simple use cases without schema files:

```typescript
import { AppSheetClient, ConnectionDefinition } from '@techdivision/appsheet';

// v3.0.0: ConnectionDefinition with tables required
const connectionDef: ConnectionDefinition = {
  appId: process.env.APPSHEET_APP_ID!,
  applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
  tables: {
    users: {
      tableName: 'Users',
      keyField: 'id',
      fields: {
        id: { type: 'Text', required: true },
        name: { type: 'Text', required: true },
        email: { type: 'Email', required: true }
      }
    }
  }
};

// v3.0.0: runAsUserEmail is required (second parameter)
const client = new AppSheetClient(connectionDef, 'user@example.com');

// CRUD operations
const rows = await client.findAll('Users');
const user = await client.findOne('Users', '[Email] = "john@example.com"');

await client.addOne('Users', { name: 'John', email: 'john@example.com' });
await client.updateOne('Users', { id: '123', name: 'John Updated' });
await client.deleteOne('Users', { id: '123' });
```

## Multi-Instance Support

Manage multiple AppSheet apps in one project:

```yaml
# config/appsheet-schema.yaml
connections:
  worklog:
    appId: ${APPSHEET_WORKLOG_APP_ID}
    applicationAccessKey: ${APPSHEET_WORKLOG_ACCESS_KEY}
    tables:
      # ...

  hr:
    appId: ${APPSHEET_HR_APP_ID}
    applicationAccessKey: ${APPSHEET_HR_ACCESS_KEY}
    tables:
      # ...
```

```typescript
// v3.0.0: runAsUserEmail required
const worklogTable = db.table('worklog', 'worklogs', 'user@example.com');
const employeeTable = db.table('hr', 'employees', 'user@example.com');
```

## Examples

See the `examples/` directory for complete examples:
- `basic-usage.ts` - Direct client usage
- `schema-based-usage.ts` - Schema-based usage
- `config/example-schema.yaml` - Example schema file

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Linting

```bash
npm run lint
npm run format
```

## Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version (X.0.0): Breaking changes
- **MINOR** version (0.X.0): New features (backward compatible)
- **PATCH** version (0.0.X): Bug fixes (backward compatible)

### Release Process

```bash
# Bug fix release (1.0.0 -> 1.0.1)
npm run version:patch

# New feature release (1.0.0 -> 1.1.0)
npm run version:minor

# Breaking change release (1.0.0 -> 2.0.0)
npm run version:major

# Pre-release (1.0.0 -> 1.0.1-beta.0)
npm run version:prerelease

# Push release
npm run release
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed versioning guidelines.

## Git-Flow

This project uses Git-Flow with three branches:

```
develop → CI only (no deployments)
staging → Staging deployment (pre-production)
main    → Production deployment
```

**Quick Reference:** [.github/GIT-FLOW.md](./.github/GIT-FLOW.md)

### Branch Flow
```
feature/xxx → develop → staging → main
```

### Quick Start
```bash
# 1. Create feature from develop
git checkout -b feature/my-feature develop

# 2. Create PR to develop (CI runs)

# 3. Merge develop to staging (deploys to staging)

# 4. Merge staging to main (deploys to production)
```

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- **Git-Flow branch strategy** (develop → staging → main)
- Semantic versioning guidelines
- Commit message conventions (Conventional Commits)
- Development workflow
- Pull request process

## License

MIT
