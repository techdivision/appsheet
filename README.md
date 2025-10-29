# AppSheet TypeScript Library

A generic TypeScript library for AppSheet CRUD operations, designed for building MCP servers and internal tools.

## Features

- 🚀 Full CRUD operations for AppSheet tables
- 📝 Runtime schema loading from YAML/JSON
- 🔧 CLI tool for schema generation and management
- 🔒 Type-safe API with TypeScript
- 🌐 Multi-instance support (multiple AppSheet apps)
- ✅ Schema-based validation
- 🔄 Connection management with health checks

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

### 2. Use in Your Code

```typescript
import { SchemaLoader, SchemaManager } from '@techdivision/appsheet';

// Load schema
const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
const db = new SchemaManager(schema);

// Use type-safe table clients
interface Worklog {
  id: string;
  date: string;
  hours: number;
  description: string;
}

const worklogsTable = db.table<Worklog>('worklog', 'worklogs');

// CRUD operations
const worklogs = await worklogsTable.findAll();
const today = await worklogsTable.find('[date] = "2025-10-27"');

await worklogsTable.add([
  { id: '123', date: '2025-10-27', hours: 8, description: 'Work done' }
]);

await worklogsTable.update([{ id: '123', hours: 7 }]);
await worklogsTable.delete([{ id: '123' }]);
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

## Direct Client Usage

For simple use cases without schema files:

```typescript
import { AppSheetClient } from '@techdivision/appsheet';

const client = new AppSheetClient({
  appId: process.env.APPSHEET_APP_ID!,
  applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
  runAsUserEmail: 'default@example.com',  // Optional: run operations as specific user
});

// CRUD operations
const rows = await client.findAll('Users');
const user = await client.findOne('Users', '[Email] = "john@example.com"');

await client.addOne('Users', { name: 'John', email: 'john@example.com' });
await client.updateOne('Users', { id: '123', name: 'John Updated' });
await client.deleteOne('Users', { id: '123' });

// Override runAsUserEmail for specific operation
await client.add({
  tableName: 'Users',
  rows: [{ name: 'Jane' }],
  properties: { RunAsUserEmail: 'admin@example.com' }
});
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
const worklogTable = db.table('worklog', 'worklogs');
const employeeTable = db.table('hr', 'employees');
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

## License

MIT
