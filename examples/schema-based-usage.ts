/**
 * Schema-based usage example (v3.1.0)
 *
 * Pattern 2: SchemaManager with Factory Injection (recommended)
 *
 * This is the recommended pattern for production use. It provides:
 * - Schema-driven table definitions from YAML/JSON
 * - Factory injection for easy testing (swap real/mock clients)
 * - Per-request user context for multi-tenant MCP servers
 * - Runtime validation based on AppSheet field types
 */

import { SchemaLoader, SchemaManager, AppSheetClientFactory, SelectorBuilder } from '../src';

// TypeScript interfaces for type safety (optional but recommended)
interface User {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Inactive' | 'Pending';
}

interface Worklog {
  id: string;
  userId: string;
  date: string;
  hours: number;
  description: string;
}

async function main() {
  // Load schema from YAML file (resolves ${ENV_VAR} placeholders)
  const schema = SchemaLoader.fromYaml('./config/example-schema.yaml');

  // Create factory and schema manager
  const clientFactory = new AppSheetClientFactory();
  const db = new SchemaManager(clientFactory, schema);

  // Get table client — runAsUserEmail is required (v3.0.0+)
  const usersTable = db.table<User>('worklog', 'users', 'user@example.com');

  // CRUD operations with runtime validation
  const users = await usersTable.findAll();
  console.log('All users:', users);

  // Find with selector (automatically wrapped in Filter() for API compliance)
  const activeUsers = await usersTable.find('[Status] = "Active"');
  console.log('Active users:', activeUsers);

  // Find one
  const john = await usersTable.findOne('[Email] = "john@example.com"');
  console.log('Found user:', john);

  // Add with validation (Email format, Enum values checked at runtime)
  await usersTable.add([{ id: '456', name: 'Bob', email: 'bob@example.com', status: 'Active' }]);

  // Update
  await usersTable.update([{ id: '456', status: 'Inactive' }]);

  // Delete
  await usersTable.delete([{ id: '456' }]);

  // --- Schema Introspection ---

  // Get table definition
  const tableDef = db.getTableDefinition('worklog', 'users');
  console.log('Table:', tableDef?.tableName); // 'extract_user'

  // Get field definition
  const statusField = db.getFieldDefinition('worklog', 'users', 'status');
  console.log('Status type:', statusField?.type); // 'Enum'

  // Get allowed values for Enum fields
  const statusValues = db.getAllowedValues('worklog', 'users', 'status');
  console.log('Allowed:', statusValues); // ['Active', 'Inactive', 'Pending']

  // --- Safe Selector Building ---

  const selector = new SelectorBuilder();

  // Build injection-safe filter from user input
  const userInput = 'some"malicious"input';
  const safeFilter = selector.buildFilter('extract_user', '[name]', userInput);
  console.log('Safe filter:', safeFilter);
  // => 'Filter(extract_user, [name] = "some\"malicious\"input")'

  // --- Multi-Tenant MCP Server Pattern ---

  // Each request gets its own user context (lightweight, on-demand)
  const userATable = db.table<User>('worklog', 'users', 'alice@example.com');
  const userBTable = db.table<User>('worklog', 'users', 'bob@example.com');

  // Operations execute with respective user's AppSheet permissions
  const aliceData = await userATable.findAll();
  const bobData = await userBTable.findAll();
}

main().catch(console.error);
