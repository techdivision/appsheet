/**
 * Test Suite: Factory Implementations (v3.0.0)
 *
 * Tests for:
 * - AppSheetClientFactory
 * - MockAppSheetClientFactory
 * - DynamicTableFactory
 *
 * @module tests/client
 */

import axios from 'axios';
import {
  AppSheetClientFactory,
  MockAppSheetClientFactory,
  DynamicTableFactory,
  AppSheetClient,
  MockAppSheetClient,
  DynamicTable,
} from '../../src/client';
import {
  ConnectionDefinition,
  SchemaConfig,
  MockDataProvider,
} from '../../src/types';

// Mock axios for AppSheetClientFactory tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppSheetClientFactory', () => {
  const mockConnectionDef: ConnectionDefinition = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
    tables: {
      users: {
        tableName: 'extract_user',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({ post: jest.fn() } as any);
  });

  it('should create an AppSheetClient instance', () => {
    const factory = new AppSheetClientFactory();
    const client = factory.create(mockConnectionDef, 'user@example.com');

    expect(client).toBeInstanceOf(AppSheetClient);
  });

  it('should create client with correct configuration', () => {
    const factory = new AppSheetClientFactory();
    const client = factory.create(mockConnectionDef, 'user@example.com');

    // Verify client can access table definitions
    const tableDef = client.getTable('users');
    expect(tableDef.tableName).toBe('extract_user');
  });

  it('should implement AppSheetClientFactoryInterface', () => {
    const factory = new AppSheetClientFactory();
    expect(typeof factory.create).toBe('function');
  });
});

describe('MockAppSheetClientFactory', () => {
  const mockConnectionDef: ConnectionDefinition = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
    tables: {
      users: {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          name: { type: 'Text', required: true },
        },
      },
    },
  };

  it('should create a MockAppSheetClient instance', () => {
    const factory = new MockAppSheetClientFactory();
    const client = factory.create(mockConnectionDef, 'user@example.com');

    expect(client).toBeInstanceOf(MockAppSheetClient);
  });

  it('should create client that implements AppSheetClientInterface', async () => {
    const factory = new MockAppSheetClientFactory();
    const client = factory.create(mockConnectionDef, 'user@example.com');

    // Test interface methods
    expect(typeof client.findAll).toBe('function');
    expect(typeof client.add).toBe('function');
    expect(typeof client.update).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.getTable).toBe('function');

    // Test basic operation
    const users = await client.findAll('users');
    expect(users).toEqual([]);
  });

  it('should accept optional MockDataProvider', () => {
    const mockData: MockDataProvider = {
      getTables: () => new Map([
        ['users', { rows: [{ id: '1', name: 'Test User' }], keyField: 'id' }],
      ]),
    };

    const factory = new MockAppSheetClientFactory(mockData);
    const client = factory.create(mockConnectionDef, 'user@example.com');

    // MockAppSheetClient should be seeded with data
    expect(client).toBeInstanceOf(MockAppSheetClient);
  });

  it('should pass dataProvider to created clients', async () => {
    const mockData: MockDataProvider = {
      getTables: () => new Map([
        ['users', { rows: [{ id: '1', name: 'Test User' }], keyField: 'id' }],
      ]),
    };

    const factory = new MockAppSheetClientFactory(mockData);
    const client = factory.create(mockConnectionDef, 'user@example.com');

    // Client should have data from provider
    const users = await client.findAll('users');
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: '1', name: 'Test User' });
  });
});

describe('DynamicTableFactory', () => {
  const mockSchema: SchemaConfig = {
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
      otherApp: {
        appId: 'other-app-id',
        applicationAccessKey: 'other-key',
        tables: {
          products: {
            tableName: 'products',
            keyField: 'product_id',
            fields: {
              product_id: { type: 'Text', required: true },
            },
          },
        },
      },
    },
  };

  it('should create DynamicTable using MockAppSheetClientFactory', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    const table = tableFactory.create('worklog', 'users', 'user@example.com');

    expect(table).toBeInstanceOf(DynamicTable);
  });

  it('should create table with correct table definition', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    const table = tableFactory.create('worklog', 'users', 'user@example.com');

    expect(table.getTableName()).toBe('extract_user');
    expect(table.getKeyField()).toBe('id');
  });

  it('should create tables for different connections', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    const usersTable = tableFactory.create('worklog', 'users', 'user@example.com');
    const productsTable = tableFactory.create('otherApp', 'products', 'user@example.com');

    expect(usersTable.getTableName()).toBe('extract_user');
    expect(productsTable.getTableName()).toBe('products');
  });

  it('should throw error for non-existent connection', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    expect(() => tableFactory.create('nonexistent', 'users', 'user@example.com')).toThrow(
      'Connection "nonexistent" not found. Available connections: worklog, otherApp'
    );
  });

  it('should throw error for non-existent table', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    expect(() => tableFactory.create('worklog', 'nonexistent', 'user@example.com')).toThrow(
      'Table "nonexistent" not found. Available tables: users, worklogs'
    );
  });

  it('should create functional tables for CRUD operations', async () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    interface User {
      id: string;
      email: string;
    }

    const table = tableFactory.create<User>('worklog', 'users', 'user@example.com');

    // Add
    const added = await table.add([{ id: '1', email: 'test@example.com' }]);
    expect(added).toHaveLength(1);

    // Find
    const found = await table.findAll();
    expect(found).toHaveLength(1);

    // Update
    const updated = await table.update([{ id: '1', email: 'updated@example.com' }]);
    expect(updated[0].email).toBe('updated@example.com');

    // Delete
    const deleted = await table.delete([{ id: '1' }]);
    expect(deleted).toBe(true);

    // Verify deleted
    const afterDelete = await table.findAll();
    expect(afterDelete).toHaveLength(0);
  });

  it('should implement DynamicTableFactoryInterface', () => {
    const clientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(clientFactory, mockSchema);

    expect(typeof tableFactory.create).toBe('function');
  });
});

describe('Factory Integration', () => {
  const schema: SchemaConfig = {
    connections: {
      myApp: {
        appId: 'my-app-id',
        applicationAccessKey: 'my-key',
        tables: {
          users: {
            tableName: 'users',
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

  it('should enable easy testing by swapping client factory', async () => {
    // Production code would use AppSheetClientFactory
    // For testing, use MockAppSheetClientFactory
    const mockClientFactory = new MockAppSheetClientFactory();
    const tableFactory = new DynamicTableFactory(mockClientFactory, schema);

    const table = tableFactory.create('myApp', 'users', 'test@example.com');

    // Add test data
    await table.add([{ id: '1', name: 'Test User' }]);

    // Verify
    const users = await table.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Test User');
  });

  it('should support pre-seeded mock data via factory', async () => {
    const testData: MockDataProvider = {
      getTables: () => new Map([
        ['users', {
          rows: [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
          ],
          keyField: 'id',
        }],
      ]),
    };

    const mockClientFactory = new MockAppSheetClientFactory(testData);
    const tableFactory = new DynamicTableFactory(mockClientFactory, schema);

    const table = tableFactory.create('myApp', 'users', 'test@example.com');

    // Table should already have data
    const users = await table.findAll();
    expect(users).toHaveLength(2);
  });
});
