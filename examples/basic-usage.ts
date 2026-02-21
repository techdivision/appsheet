/**
 * Basic usage example for AppSheet library (v3.1.0)
 *
 * Pattern 1: Direct AppSheetClient usage
 *
 * This example shows how to use AppSheetClient directly with a ConnectionDefinition.
 * For schema-based usage with factory injection, see schema-based-usage.ts.
 */

import { AppSheetClient, ConnectionDefinition } from '../src';

async function main() {
  // Define connection with table schemas
  const connectionDef: ConnectionDefinition = {
    appId: process.env.APPSHEET_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
    tables: {
      users: {
        tableName: 'extract_user',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          name: { type: 'Name', required: true },
          email: { type: 'Email', required: true },
          status: { type: 'Enum', allowedValues: ['Active', 'Inactive'] },
        },
      },
    },
  };

  // Create client — runAsUserEmail is required (v3.0.0+)
  const client = new AppSheetClient(connectionDef, 'user@example.com');

  // Add rows
  const newUsers = await client.add({
    tableName: 'extract_user',
    rows: [
      { name: 'John Doe', email: 'john@example.com', status: 'Active' },
      { name: 'Jane Smith', email: 'jane@example.com', status: 'Active' },
    ],
  });
  console.log('Created users:', newUsers.rows);

  // Find all
  const allUsers = await client.findAll('extract_user');
  console.log('All users:', allUsers);

  // Find with selector — automatically wrapped in Filter() by SelectorBuilder
  const activeUsers = await client.find({
    tableName: 'extract_user',
    selector: '[Status] = "Active"',
  });
  console.log('Active users:', activeUsers.rows);

  // Find one
  const john = await client.findOne('extract_user', '[Email] = "john@example.com"');
  console.log('Found user:', john);

  // Update
  const updated = await client.updateOne('extract_user', {
    id: '123',
    name: 'John Updated',
  });
  console.log('Updated user:', updated);

  // Delete
  await client.deleteOne('extract_user', { id: '123' });
  console.log('User deleted');

  // Get table definition from connection
  const tableDef = client.getTable('users');
  console.log('Table name:', tableDef.tableName); // 'extract_user'
  console.log('Key field:', tableDef.keyField); // 'id'
}

main().catch(console.error);
