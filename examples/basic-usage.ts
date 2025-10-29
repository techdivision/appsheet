/**
 * Basic usage example for AppSheet library
 */

import { AppSheetClient } from '../src';

async function main() {
  // Create client with optional runAsUserEmail
  const client = new AppSheetClient({
    appId: process.env.APPSHEET_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
    runAsUserEmail: 'default@example.com', // Optional: run all operations as this user
  });

  // Add rows (uses global runAsUserEmail)
  const newUsers = await client.add({
    tableName: 'Users',
    rows: [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
    ],
  });
  console.log('Created users:', newUsers.rows);

  // Find all
  const allUsers = await client.findAll('Users');
  console.log('All users:', allUsers);

  // Find with selector
  const activeUsers = await client.find({
    tableName: 'Users',
    selector: '[Status] = "Active"',
  });
  console.log('Active users:', activeUsers.rows);

  // Update
  const updated = await client.updateOne('Users', {
    id: '123',
    name: 'John Updated',
  });
  console.log('Updated user:', updated);

  // Delete with per-operation runAsUserEmail override
  await client.delete({
    tableName: 'Users',
    rows: [{ id: '123' }],
    properties: {
      RunAsUserEmail: 'admin@example.com', // Override for this operation
    },
  });
  console.log('User deleted');
}

main().catch(console.error);
