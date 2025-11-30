/**
 * Test Suite: ConnectionManager v3.0.0 - Factory Injection Pattern
 *
 * Tests for ConnectionManager with injected client factory and schema.
 * The v3.0.0 API simplifies ConnectionManager to:
 * - Accept factory and schema in constructor
 * - Create clients on-demand via get(connectionName, runAsUserEmail)
 * - Provide list() and has() for introspection
 *
 * @module tests/utils
 */

import { ConnectionManager } from '../../src/utils/ConnectionManager';
import {
  MockAppSheetClientFactory,
  MockAppSheetClient,
} from '../../src/client';
import {
  SchemaConfig,
  AppSheetClientFactoryInterface,
  MockDataProvider,
} from '../../src/types';

describe('ConnectionManager v3.0.0', () => {
  /**
   * Test schema with multiple connections.
   */
  const testSchema: SchemaConfig = {
    connections: {
      worklog: {
        appId: 'worklog-app-id',
        applicationAccessKey: 'worklog-key',
        tables: {
          users: {
            tableName: 'extract_user',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              email: { type: 'Email', required: true },
            },
          },
          worklogs: {
            tableName: 'extract_worklog',
            keyField: 'worklog_id',
            fields: {
              worklog_id: { type: 'Text', required: true },
              date: { type: 'Date', required: true },
            },
          },
        },
      },
      inventory: {
        appId: 'inventory-app-id',
        applicationAccessKey: 'inventory-key',
        tables: {
          products: {
            tableName: 'products',
            keyField: 'product_id',
            fields: {
              product_id: { type: 'Text', required: true },
              name: { type: 'Text', required: true },
            },
          },
        },
      },
    },
  };

  /**
   * Empty schema for edge case testing.
   */
  const emptySchema: SchemaConfig = {
    connections: {},
  };

  describe('Constructor', () => {
    it('should accept client factory and schema', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      expect(manager).toBeInstanceOf(ConnectionManager);
    });

    it('should work with empty schema', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, emptySchema);

      expect(manager.list()).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should create client using injected factory', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const client = manager.get('worklog', 'user@example.com');

      expect(client).toBeInstanceOf(MockAppSheetClient);
    });

    it('should pass connection definition and user email to factory', () => {
      const factory = new MockAppSheetClientFactory();
      const createSpy = jest.spyOn(factory, 'create');
      const manager = new ConnectionManager(factory, testSchema);

      manager.get('worklog', 'user@example.com');

      expect(createSpy).toHaveBeenCalledWith(
        testSchema.connections.worklog,
        'user@example.com'
      );
    });

    it('should create client with correct table definitions', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const client = manager.get('worklog', 'user@example.com');

      const tableDef = client.getTable('users');
      expect(tableDef.tableName).toBe('extract_user');
      expect(tableDef.keyField).toBe('id');
    });

    it('should create new client on each call (no caching)', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const client1 = manager.get('worklog', 'user@example.com');
      const client2 = manager.get('worklog', 'user@example.com');

      expect(client1).not.toBe(client2);
    });

    it('should create clients for different users', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const client1 = manager.get('worklog', 'user1@example.com');
      const client2 = manager.get('worklog', 'user2@example.com');

      expect(client1).not.toBe(client2);
    });

    it('should create clients for different connections', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const worklogClient = manager.get('worklog', 'user@example.com');
      const inventoryClient = manager.get('inventory', 'user@example.com');

      expect(worklogClient).not.toBe(inventoryClient);
      expect(worklogClient.getTable('users').tableName).toBe('extract_user');
      expect(inventoryClient.getTable('products').tableName).toBe('products');
    });

    it('should throw error for non-existent connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      expect(() => manager.get('nonexistent', 'user@example.com')).toThrow(
        'Connection "nonexistent" not found. Available connections: worklog, inventory'
      );
    });

    it('should throw error with "none" when schema has no connections', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, emptySchema);

      expect(() => manager.get('any', 'user@example.com')).toThrow(
        'Connection "any" not found. Available connections: none'
      );
    });
  });

  describe('list()', () => {
    it('should return all connection names', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const names = manager.list();

      expect(names).toEqual(['worklog', 'inventory']);
    });

    it('should return empty array for empty schema', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, emptySchema);

      expect(manager.list()).toEqual([]);
    });
  });

  describe('has()', () => {
    it('should return true for existing connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      expect(manager.has('worklog')).toBe(true);
      expect(manager.has('inventory')).toBe(true);
    });

    it('should return false for non-existing connection', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      expect(manager.has('nonexistent')).toBe(false);
    });

    it('should return false for empty schema', () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, emptySchema);

      expect(manager.has('any')).toBe(false);
    });
  });

  describe('Factory injection patterns', () => {
    it('should enable testing with MockAppSheetClientFactory', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const client = manager.get('worklog', 'test@example.com');

      // Add data using addOne convenience method
      await client.addOne('users', { id: '1', email: 'test@example.com' });

      // Verify data
      const users = await client.findAll('users');
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('test@example.com');
    });

    it('should support pre-seeded mock data via factory', async () => {
      const testData: MockDataProvider = {
        getTables: () =>
          new Map([
            [
              'users',
              {
                rows: [
                  { id: '1', email: 'alice@example.com' },
                  { id: '2', email: 'bob@example.com' },
                ],
                keyField: 'id',
              },
            ],
          ]),
      };

      const factory = new MockAppSheetClientFactory(testData);
      const manager = new ConnectionManager(factory, testSchema);

      const client = manager.get('worklog', 'test@example.com');
      const users = await client.findAll('users');

      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('alice@example.com');
    });

    it('should work with custom factory implementations', () => {
      // Create a spy factory to verify calls
      const mockClient = new MockAppSheetClient(
        testSchema.connections.worklog,
        'custom@example.com'
      );

      const customFactory: AppSheetClientFactoryInterface = {
        create: jest.fn().mockReturnValue(mockClient),
      };

      const manager = new ConnectionManager(customFactory, testSchema);
      const client = manager.get('worklog', 'custom@example.com');

      expect(customFactory.create).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockClient);
    });
  });

  describe('Multi-tenant scenarios', () => {
    it('should create isolated clients for concurrent users', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      // Simulate two users making concurrent requests
      const user1Client = manager.get('worklog', 'user1@example.com');
      const user2Client = manager.get('worklog', 'user2@example.com');

      // Each user adds their own data
      await user1Client.addOne('users', { id: '1', email: 'user1@example.com' });
      await user2Client.addOne('users', { id: '2', email: 'user2@example.com' });

      // Note: In mock mode, clients share data store
      // In production with AppSheet API, each user would have their own permissions
      expect(user1Client).not.toBe(user2Client);
    });

    it('should support same user accessing multiple connections', async () => {
      const factory = new MockAppSheetClientFactory();
      const manager = new ConnectionManager(factory, testSchema);

      const userEmail = 'admin@example.com';

      const worklogClient = manager.get('worklog', userEmail);
      const inventoryClient = manager.get('inventory', userEmail);

      // User can access different apps
      await worklogClient.addOne('users', { id: '1', email: userEmail });
      await inventoryClient.addOne('products', { product_id: 'P1', name: 'Widget' });

      const users = await worklogClient.findAll('users');
      const products = await inventoryClient.findAll('products');

      expect(users).toHaveLength(1);
      expect(products).toHaveLength(1);
    });
  });
});
