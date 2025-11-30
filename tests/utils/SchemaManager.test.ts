/**
 * Test Suite: SchemaManager v3.0.0 - Factory-Based Table Creation
 *
 * Tests for SchemaManager with injected client factory and schema.
 * The v3.0.0 API:
 * - Accept clientFactory and schema in constructor
 * - Create table clients on-demand via table(connection, table, userEmail)
 * - runAsUserEmail is required (no default/optional user)
 *
 * @module tests/utils
 */

import { SchemaManager } from '../../src/utils/SchemaManager';
import { SchemaConfig, MockDataProvider } from '../../src/types';
import { DynamicTable, MockAppSheetClientFactory } from '../../src/client';

describe('SchemaManager v3.0.0', () => {
  /**
   * Base schema configuration for testing.
   * Includes two connections with different tables.
   */
  const baseSchema: SchemaConfig = {
    connections: {
      'test-conn': {
        appId: 'app-1',
        applicationAccessKey: 'key-1',
        tables: {
          users: {
            tableName: 'extract_user',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              email: { type: 'Email', required: true },
              name: { type: 'Text', required: false },
            },
          },
          worklogs: {
            tableName: 'extract_worklog',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              date: { type: 'Date', required: true },
              hours: { type: 'Number', required: true },
            },
          },
        },
      },
      'hr-conn': {
        appId: 'app-2',
        applicationAccessKey: 'key-2',
        tables: {
          employees: {
            tableName: 'extract_employee',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              name: { type: 'Text', required: true },
            },
          },
        },
      },
    },
  };

  describe('Constructor', () => {
    it('should accept client factory and schema', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager).toBeInstanceOf(SchemaManager);
    });

    it('should validate schema on construction', () => {
      const factory = new MockAppSheetClientFactory();
      const invalidSchema: SchemaConfig = {
        connections: {
          invalid: {
            appId: '', // Invalid: empty appId
            applicationAccessKey: 'key',
            tables: {},
          },
        },
      };

      expect(() => new SchemaManager(factory, invalidSchema)).toThrow(
        /Invalid schema/
      );
    });

    it('should work with MockAppSheetClientFactory', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.getConnections()).toEqual(['test-conn', 'hr-conn']);
    });
  });

  describe('table()', () => {
    it('should create DynamicTable using injected factory', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const table = manager.table('test-conn', 'users', 'user@example.com');

      expect(table).toBeInstanceOf(DynamicTable);
    });

    it('should create table with correct definition', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const table = manager.table('test-conn', 'users', 'user@example.com');

      expect(table.getTableName()).toBe('extract_user');
      expect(table.getKeyField()).toBe('id');
    });

    it('should create new instance on each call (no caching)', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const table1 = manager.table('test-conn', 'users', 'user@example.com');
      const table2 = manager.table('test-conn', 'users', 'user@example.com');

      expect(table1).not.toBe(table2);
    });

    it('should create separate tables for different users', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const table1 = manager.table('test-conn', 'users', 'user1@example.com');
      const table2 = manager.table('test-conn', 'users', 'user2@example.com');

      expect(table1).not.toBe(table2);
      expect(table1.getTableName()).toBe('extract_user');
      expect(table2.getTableName()).toBe('extract_user');
    });

    it('should create tables from different connections', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const usersTable = manager.table('test-conn', 'users', 'user@example.com');
      const employeesTable = manager.table('hr-conn', 'employees', 'user@example.com');

      expect(usersTable).not.toBe(employeesTable);
      expect(usersTable.getTableName()).toBe('extract_user');
      expect(employeesTable.getTableName()).toBe('extract_employee');
    });

    it('should throw error for non-existent connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(() => manager.table('nonexistent', 'users', 'user@example.com')).toThrow(
        'Connection "nonexistent" not found. Available connections: test-conn, hr-conn'
      );
    });

    it('should throw error for non-existent table', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(() => manager.table('test-conn', 'nonexistent', 'user@example.com')).toThrow(
        'Table "nonexistent" not found. Available tables: users, worklogs'
      );
    });
  });

  describe('getConnections()', () => {
    it('should return all connection names', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.getConnections()).toEqual(['test-conn', 'hr-conn']);
    });
  });

  describe('getTables()', () => {
    it('should return all tables for a connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.getTables('test-conn')).toEqual(['users', 'worklogs']);
      expect(manager.getTables('hr-conn')).toEqual(['employees']);
    });

    it('should throw error for non-existent connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(() => manager.getTables('nonexistent')).toThrow(
        'Connection "nonexistent" not found. Available connections: test-conn, hr-conn'
      );
    });
  });

  describe('hasConnection()', () => {
    it('should return true for existing connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.hasConnection('test-conn')).toBe(true);
      expect(manager.hasConnection('hr-conn')).toBe(true);
    });

    it('should return false for non-existing connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.hasConnection('nonexistent')).toBe(false);
    });
  });

  describe('hasTable()', () => {
    it('should return true for existing table in connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.hasTable('test-conn', 'users')).toBe(true);
      expect(manager.hasTable('test-conn', 'worklogs')).toBe(true);
      expect(manager.hasTable('hr-conn', 'employees')).toBe(true);
    });

    it('should return false for non-existing table', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.hasTable('test-conn', 'nonexistent')).toBe(false);
    });

    it('should return false for non-existing connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.hasTable('nonexistent', 'users')).toBe(false);
    });
  });

  describe('getSchema()', () => {
    it('should return the schema configuration', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      expect(manager.getSchema()).toBe(baseSchema);
    });
  });

  describe('CRUD operations with mock factory', () => {
    it('should support add and find operations', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      interface User {
        id: string;
        email: string;
        name?: string;
      }

      const table = manager.table<User>('test-conn', 'users', 'test@example.com');

      // Add
      const added = await table.add([{ id: '1', email: 'alice@example.com', name: 'Alice' }]);
      expect(added).toHaveLength(1);

      // Find
      const users = await table.findAll();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('alice@example.com');
    });

    it('should support update and delete operations', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const table = manager.table('test-conn', 'users', 'test@example.com');

      // Add initial data
      await table.add([{ id: '1', email: 'alice@example.com' }]);

      // Update
      const updated = await table.update([{ id: '1', email: 'alice.new@example.com' }]);
      expect(updated[0].email).toBe('alice.new@example.com');

      // Delete
      const deleted = await table.delete([{ id: '1' }]);
      expect(deleted).toBe(true);

      // Verify deleted
      const users = await table.findAll();
      expect(users).toHaveLength(0);
    });

    it('should support pre-seeded mock data via factory', async () => {
      // Note: MockDataProvider table names must match the AppSheet table names
      // (e.g., 'extract_user') not the schema table names (e.g., 'users')
      // because DynamicTable.findAll() uses definition.tableName
      const testData: MockDataProvider = {
        getTables: () =>
          new Map([
            [
              'extract_user', // Use AppSheet table name, not schema name
              {
                rows: [
                  { id: '1', email: 'alice@example.com', name: 'Alice' },
                  { id: '2', email: 'bob@example.com', name: 'Bob' },
                ],
                keyField: 'id',
              },
            ],
          ]),
      };

      const factory = new MockAppSheetClientFactory(testData);
      const manager = new SchemaManager(factory, baseSchema);

      // First table call - gets seeded data
      const table1 = manager.table('test-conn', 'users', 'test@example.com');
      const users1 = await table1.findAll();
      expect(users1).toHaveLength(2);
      expect(users1[0].name).toBe('Alice');
      expect(users1[1].name).toBe('Bob');

      // Second table call - also gets seeded data (new client instance)
      const table2 = manager.table('test-conn', 'users', 'test@example.com');
      const users2 = await table2.findAll();
      expect(users2).toHaveLength(2);
    });
  });

  describe('Multi-tenant scenarios', () => {
    it('should create isolated tables for concurrent users', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      // Simulate two users making concurrent requests
      const user1Table = manager.table('test-conn', 'users', 'user1@example.com');
      const user2Table = manager.table('test-conn', 'users', 'user2@example.com');

      // Each user operates on their own table instance
      await user1Table.add([{ id: '1', email: 'user1@example.com' }]);
      await user2Table.add([{ id: '2', email: 'user2@example.com' }]);

      // Tables are different instances
      expect(user1Table).not.toBe(user2Table);
    });

    it('should support same user accessing multiple tables', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new SchemaManager(factory, baseSchema);

      const userEmail = 'admin@example.com';

      const usersTable = manager.table('test-conn', 'users', userEmail);
      const worklogsTable = manager.table('test-conn', 'worklogs', userEmail);

      // User can access different tables
      await usersTable.add([{ id: '1', email: userEmail }]);
      await worklogsTable.add([{ id: 'W1', date: '2025-01-01', hours: 8 }]);

      const users = await usersTable.findAll();
      const worklogs = await worklogsTable.findAll();

      expect(users).toHaveLength(1);
      expect(worklogs).toHaveLength(1);
    });
  });
});
