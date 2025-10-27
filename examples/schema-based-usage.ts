/**
 * Schema-based usage example
 */

import { SchemaLoader, SchemaManager } from '../src';

async function main() {
  // Load schema from file
  const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');

  // Create schema manager
  const db = new SchemaManager(schema);

  // Use type-safe table clients
  interface User {
    id: string;
    name: string;
    email: string;
    status: string;
  }

  // Get table client
  const usersTable = db.table<User>('worklog', 'users');

  // CRUD operations
  const users = await usersTable.findAll();
  console.log('All users:', users);

  const activeUsers = await usersTable.find('[Status] = "Active"');
  console.log('Active users:', activeUsers);

  await usersTable.add([
    { id: '456', name: 'Bob', email: 'bob@example.com', status: 'Active' },
  ]);

  await usersTable.update([{ id: '456', status: 'Inactive' }]);

  await usersTable.delete([{ id: '456' }]);
}

main().catch(console.error);
