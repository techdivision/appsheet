# TSyringe DI Integration - Testing Strategy

**Ticket:** SOSO-246
**Projekt:** @techdivision/appsheet

---

## 1. Testing Philosophy

### 1.1 Ziele

1. **Testbarkeit durch DI:** Alle Komponenten können isoliert getestet werden
2. **Mock vs. Real:** Einfacher Swap zwischen Mock- und Real-Clients
3. **Test Isolation:** Keine Side-Effects zwischen Tests
4. **Performance:** Tests bleiben schnell (<100ms pro Test)
5. **Rückwärtskompatibilität:** Bestehende Tests funktionieren weiter

### 1.2 Test-Pyramide

```
           ┌─────────────┐
           │   E2E Tests │  (10% - Real API, optional)
           │  (Optional) │
           └─────────────┘
         ┌─────────────────┐
         │ Integration Tests│  (30% - DI + Mock)
         │   (DI-based)    │
         └─────────────────┘
     ┌─────────────────────────┐
     │     Unit Tests          │  (60% - Direct + DI)
     │  (Real + Mock Clients)  │
     └─────────────────────────┘
```

---

## 2. Unit Testing Strategy

### 2.1 Real Client Unit Tests

**Ziel:** Testen der Core-Funktionalität ohne DI-Overhead

```typescript
// tests/client/AppSheetClient.test.ts
import { AppSheetClient } from '../../src/client/AppSheetClient';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppSheetClient (Unit)', () => {
  let client: AppSheetClient;

  beforeEach(() => {
    // Manual instantiation (backwards compatible)
    client = new AppSheetClient({
      appId: 'test-app',
      applicationAccessKey: 'test-key'
    });

    mockedAxios.create.mockReturnValue({
      post: jest.fn()
    } as any);
  });

  test('should create client with config', () => {
    expect(client).toBeDefined();
    expect(client.getConfig().appId).toBe('test-app');
  });

  test('should make API call with correct payload', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      data: { Rows: [{ id: '1', name: 'Test' }], Warnings: [] }
    });

    (client as any).axios.post = mockPost;

    await client.findAll('Users');

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/Action'),
      expect.objectContaining({
        Action: 'Find',
        Properties: {},
        Rows: []
      })
    );
  });

  test('should handle API errors correctly', async () => {
    const mockPost = jest.fn().mockRejectedValue({
      response: { status: 401, data: { error: 'Unauthorized' } }
    });

    (client as any).axios.post = mockPost;

    await expect(client.findAll('Users')).rejects.toThrow('Unauthorized');
  });
});
```

### 2.2 Mock Client Unit Tests

```typescript
// tests/client/MockAppSheetClient.test.ts
import { MockAppSheetClient } from '../../src/client/MockAppSheetClient';

describe('MockAppSheetClient (Unit)', () => {
  let mockClient: MockAppSheetClient;

  beforeEach(() => {
    // Manual instantiation (backwards compatible)
    mockClient = new MockAppSheetClient({
      appId: 'test-app',
      applicationAccessKey: 'test-key'
    });
    mockClient.seedDatabase();
  });

  test('should create mock client with in-memory database', () => {
    expect(mockClient).toBeDefined();
  });

  test('should add and retrieve data', async () => {
    await mockClient.addOne('users', { id: '1', name: 'Alice' });

    const users = await mockClient.findAll('users');
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
  });

  test('should support CRUD operations', async () => {
    // Create
    const created = await mockClient.addOne('users', { id: '1', name: 'Bob' });
    expect(created.id).toBe('1');

    // Read
    let users = await mockClient.findAll('users');
    expect(users).toHaveLength(1);

    // Update
    const updated = await mockClient.updateOne('users', { id: '1', name: 'Updated Bob' });
    expect(updated.name).toBe('Updated Bob');

    // Delete
    await mockClient.deleteOne('users', { id: '1' });
    users = await mockClient.findAll('users');
    expect(users).toHaveLength(0);
  });

  test('should apply selectors correctly', async () => {
    await mockClient.addOne('users', { id: '1', name: 'Alice', role: 'admin' });
    await mockClient.addOne('users', { id: '2', name: 'Bob', role: 'user' });

    const admins = await mockClient.findOne('users', '[role] = "admin"');
    expect(admins?.name).toBe('Alice');
  });
});
```

### 2.3 DI-based Unit Tests

```typescript
// tests/di/client-di.test.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { AppSheetClient, MockAppSheetClient } from '../../src/client';
import { AppSheetConfig } from '../../src/types';

describe('AppSheetClient via DI (Unit)', () => {
  beforeEach(() => {
    container.reset();
  });

  test('should resolve real client via DI', () => {
    container.register<AppSheetConfig>('AppSheetConfig', {
      useValue: { appId: 'test', applicationAccessKey: 'test' }
    });

    const client = container.resolve(AppSheetClient);

    expect(client).toBeInstanceOf(AppSheetClient);
    expect(client.getConfig().appId).toBe('test');
  });

  test('should resolve mock client via DI', () => {
    container.register<AppSheetConfig>('AppSheetConfig', {
      useValue: { appId: 'test', applicationAccessKey: 'test' }
    });

    const mockClient = container.resolve(MockAppSheetClient);

    expect(mockClient).toBeInstanceOf(MockAppSheetClient);
    expect(mockClient.getConfig().appId).toBe('test');
  });

  test('should swap real and mock clients via interface token', () => {
    container.register<AppSheetConfig>('AppSheetConfig', {
      useValue: { appId: 'test', applicationAccessKey: 'test' }
    });

    // Register real client
    container.register('AppSheetClient', { useClass: AppSheetClient });
    const realClient = container.resolve<AppSheetClientInterface>('AppSheetClient');
    expect(realClient.constructor.name).toBe('AppSheetClient');

    // Swap to mock client
    container.register('AppSheetClient', { useClass: MockAppSheetClient });
    const mockClient = container.resolve<AppSheetClientInterface>('AppSheetClient');
    expect(mockClient.constructor.name).toBe('MockAppSheetClient');
  });
});
```

---

## 3. Integration Testing Strategy

### 3.1 Schema-based Integration Tests

```typescript
// tests/integration/schema-integration.test.ts
import 'reflect-metadata';
import { setupTestContainer, MockDataProvider } from '../../src/di';
import { SchemaConfig } from '../../src/types';
import { SchemaManager } from '../../src/utils/SchemaManager';

class IntegrationTestData implements MockDataProvider {
  getTables(): Map<string, TableData> {
    return new Map([
      ['users', {
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
          { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' }
        ],
        keyField: 'id'
      }],
      ['orders', {
        rows: [
          { id: 'o1', user_id: '1', total: 100, status: 'completed' },
          { id: 'o2', user_id: '2', total: 50, status: 'pending' }
        ],
        keyField: 'id'
      }]
    ]);
  }
}

describe('Schema Integration Tests', () => {
  let container: DependencyContainer;
  let schema: SchemaConfig;

  beforeEach(() => {
    schema = {
      connections: {
        main: {
          appId: 'test',
          applicationAccessKey: 'test',
          tables: {
            users: {
              tableName: 'users',
              keyField: 'id',
              fields: {
                id: { type: 'Text', required: true },
                name: { type: 'Name', required: true },
                email: { type: 'Email', required: true },
                role: {
                  type: 'Enum',
                  required: true,
                  allowedValues: ['admin', 'user']
                }
              }
            },
            orders: {
              tableName: 'orders',
              keyField: 'id',
              fields: {
                id: { type: 'Text', required: true },
                user_id: { type: 'Text', required: true },
                total: { type: 'Price', required: true },
                status: { type: 'Text', required: false }
              }
            }
          }
        }
      }
    };

    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new IntegrationTestData(),
      schema
    );
  });

  afterEach(() => {
    container.reset();
  });

  test('should perform cross-table queries', async () => {
    const db = container.resolve(SchemaManager);

    const usersTable = db.table('main', 'users');
    const ordersTable = db.table('main', 'orders');

    // Get all users
    const users = await usersTable.findAll();
    expect(users).toHaveLength(2);

    // Get orders for Alice (user_id = '1')
    const aliceOrders = await ordersTable.find('[user_id] = "1"');
    expect(aliceOrders).toHaveLength(1);
    expect(aliceOrders[0].total).toBe(100);

    // Get completed orders
    const completedOrders = await ordersTable.find('[status] = "completed"');
    expect(completedOrders).toHaveLength(1);
  });

  test('should validate enum fields', async () => {
    const db = container.resolve(SchemaManager);
    const usersTable = db.table('main', 'users');

    // Valid role
    await expect(
      usersTable.add([{ id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'user' }])
    ).resolves.toBeDefined();

    // Invalid role
    await expect(
      usersTable.add([{ id: '4', name: 'Dave', email: 'dave@example.com', role: 'invalid' }])
    ).rejects.toThrow();
  });

  test('should handle complex workflows', async () => {
    const db = container.resolve(SchemaManager);

    const usersTable = db.table('main', 'users');
    const ordersTable = db.table('main', 'orders');

    // Add new user
    const newUser = await usersTable.add([
      { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'user' }
    ]);
    expect(newUser).toHaveLength(1);

    // Create order for new user
    const newOrder = await ordersTable.add([
      { id: 'o3', user_id: '3', total: 75, status: 'pending' }
    ]);
    expect(newOrder).toHaveLength(1);

    // Verify order exists
    const charlieOrders = await ordersTable.find('[user_id] = "3"');
    expect(charlieOrders).toHaveLength(1);

    // Update order status
    await ordersTable.update([{ id: 'o3', status: 'completed' }]);

    // Verify update
    const completedOrders = await ordersTable.find('[status] = "completed"');
    expect(completedOrders).toHaveLength(2);  // Including original completed order
  });
});
```

### 3.2 Connection Manager Integration Tests

```typescript
// tests/integration/connection-manager.test.ts
import 'reflect-metadata';
import { container, ConnectionManager, ClientFactory } from '../../src';
import { MockAppSheetClient } from '../../src/client';

describe('ConnectionManager Integration Tests', () => {
  beforeEach(() => {
    container.reset();

    // Register mock client factory
    container.register<ClientFactory>('ClientFactory', {
      useFactory: (c) => (config) => {
        const childContainer = c.createChildContainer();
        childContainer.register('AppSheetConfig', { useValue: config });
        return childContainer.resolve(MockAppSheetClient);
      }
    });
  });

  afterEach(() => {
    container.reset();
  });

  test('should manage multiple connections', async () => {
    const manager = container.resolve(ConnectionManager);

    // Register multiple connections
    manager.register({ name: 'conn1', appId: 'app1', applicationAccessKey: 'key1' });
    manager.register({ name: 'conn2', appId: 'app2', applicationAccessKey: 'key2' });
    manager.register({ name: 'conn3', appId: 'app3', applicationAccessKey: 'key3' });

    // Verify all connections exist
    expect(manager.has('conn1')).toBe(true);
    expect(manager.has('conn2')).toBe(true);
    expect(manager.has('conn3')).toBe(true);

    // Get clients
    const client1 = manager.get('conn1');
    const client2 = manager.get('conn2');

    expect(client1.getConfig().appId).toBe('app1');
    expect(client2.getConfig().appId).toBe('app2');

    // List connections
    const connections = manager.list();
    expect(connections).toEqual(['conn1', 'conn2', 'conn3']);
  });

  test('should perform health checks', async () => {
    const manager = container.resolve(ConnectionManager);

    manager.register({ name: 'healthy', appId: 'app1', applicationAccessKey: 'key1' });
    manager.register({ name: 'healthy2', appId: 'app2', applicationAccessKey: 'key2' });

    // Mock clients are always "healthy" (no real API calls)
    const health = await manager.healthCheck();

    expect(health.healthy).toBe(true);
    expect(health.healthy2).toBe(true);
  });

  test('should isolate connection data', async () => {
    const manager = container.resolve(ConnectionManager);

    manager.register({ name: 'conn1', appId: 'app1', applicationAccessKey: 'key1' });
    manager.register({ name: 'conn2', appId: 'app2', applicationAccessKey: 'key2' });

    const client1 = manager.get('conn1');
    const client2 = manager.get('conn2');

    // Add data to conn1
    await client1.addOne('users', { id: '1', name: 'Alice' });

    // Verify conn1 has data
    const conn1Users = await client1.findAll('users');
    expect(conn1Users).toHaveLength(1);

    // Verify conn2 has no data (isolated)
    const conn2Users = await client2.findAll('users');
    expect(conn2Users).toHaveLength(0);
  });
});
```

---

## 4. Test Fixtures & Data Management

### 4.1 Fixture-based Test Data

```typescript
// tests/fixtures/test-data.yaml
users:
  rows:
    - id: "1"
      name: "Alice"
      email: "alice@example.com"
      role: "admin"
      created_at: "2025-01-01T00:00:00Z"
    - id: "2"
      name: "Bob"
      email: "bob@example.com"
      role: "user"
      created_at: "2025-01-02T00:00:00Z"
  keyField: "id"

orders:
  rows:
    - id: "o1"
      user_id: "1"
      total: 100
      status: "completed"
      created_at: "2025-01-05T00:00:00Z"
    - id: "o2"
      user_id: "2"
      total: 50
      status: "pending"
      created_at: "2025-01-06T00:00:00Z"
  keyField: "id"
```

**Loader:**
```typescript
// tests/fixtures/YamlFixtureLoader.ts
import * as fs from 'fs';
import * as yaml from 'yaml';
import { MockDataProvider, TableData } from '../../src/types';

export class YamlFixtureLoader implements MockDataProvider {
  constructor(private fixturePath: string) {}

  getTables(): Map<string, TableData> {
    const content = fs.readFileSync(this.fixturePath, 'utf-8');
    const fixtures = yaml.parse(content);

    const tables = new Map<string, TableData>();
    for (const [tableName, tableData] of Object.entries(fixtures)) {
      tables.set(tableName, tableData as TableData);
    }

    return tables;
  }
}

// Usage in tests
describe('Fixture-based Tests', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    const fixtures = new YamlFixtureLoader('./tests/fixtures/test-data.yaml');
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      fixtures
    );
  });

  test('should load data from YAML fixtures', async () => {
    const client = container.resolve<AppSheetClientInterface>('AppSheetClient');

    const users = await client.findAll('users');
    expect(users).toHaveLength(2);

    const orders = await client.findAll('orders');
    expect(orders).toHaveLength(2);
  });
});
```

### 4.2 Dynamic Test Data Generator

```typescript
// tests/fixtures/DataGenerator.ts
import { MockDataProvider, TableData } from '../../src/types';
import { faker } from '@faker-js/faker';

export class DataGenerator implements MockDataProvider {
  constructor(
    private userCount: number = 100,
    private ordersPerUser: number = 5
  ) {}

  getTables(): Map<string, TableData> {
    const tables = new Map<string, TableData>();

    // Generate users
    const users = Array.from({ length: this.userCount }, (_, i) => ({
      id: `user-${i + 1}`,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: i % 10 === 0 ? 'admin' : 'user',
      created_at: faker.date.past().toISOString()
    }));

    tables.set('users', { rows: users, keyField: 'id' });

    // Generate orders
    const orders = users.flatMap(user =>
      Array.from({ length: this.ordersPerUser }, (_, i) => ({
        id: `order-${user.id}-${i + 1}`,
        user_id: user.id,
        total: faker.number.int({ min: 10, max: 1000 }),
        status: faker.helpers.arrayElement(['pending', 'completed', 'cancelled']),
        created_at: faker.date.recent().toISOString()
      }))
    );

    tables.set('orders', { rows: orders, keyField: 'id' });

    return tables;
  }
}

// Usage for load testing
describe('Performance Tests', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    // Generate 1000 users with 5 orders each (5000 orders total)
    const generator = new DataGenerator(1000, 5);
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      generator
    );
  });

  test('should handle large datasets', async () => {
    const client = container.resolve<AppSheetClientInterface>('AppSheetClient');

    const users = await client.findAll('users');
    expect(users).toHaveLength(1000);

    const orders = await client.findAll('orders');
    expect(orders).toHaveLength(5000);
  });
});
```

---

## 5. Test Organization & Best Practices

### 5.1 Test Suite Structure

```
tests/
├── unit/
│   ├── client/
│   │   ├── AppSheetClient.test.ts
│   │   ├── MockAppSheetClient.test.ts
│   │   └── DynamicTable.test.ts
│   ├── utils/
│   │   ├── SchemaLoader.test.ts
│   │   ├── SchemaManager.test.ts
│   │   └── ConnectionManager.test.ts
│   └── di/
│       ├── client-di.test.ts
│       ├── injection-tokens.test.ts
│       └── container-lifecycle.test.ts
├── integration/
│   ├── schema-integration.test.ts
│   ├── connection-manager.test.ts
│   ├── multi-connection.test.ts
│   └── hybrid-testing.test.ts
├── e2e/ (optional)
│   └── real-api.test.ts
├── fixtures/
│   ├── test-data.yaml
│   ├── YamlFixtureLoader.ts
│   └── DataGenerator.ts
└── helpers/
    ├── di-setup.ts
    ├── test-containers.ts
    └── assertions.ts
```

### 5.2 Naming Conventions

```typescript
// Unit tests - Manual instantiation
describe('AppSheetClient (Unit)', () => {
  test('should...', () => {});
});

// Unit tests - DI-based
describe('AppSheetClient via DI (Unit)', () => {
  test('should resolve...', () => {});
});

// Integration tests
describe('Schema Integration Tests', () => {
  test('should perform cross-table queries', () => {});
});

// E2E tests
describe('Real API E2E Tests', () => {
  test('should connect to production API', () => {});
});
```

### 5.3 Test Helpers

```typescript
// tests/helpers/assertions.ts

/**
 * Custom Jest matchers for AppSheet
 */
export function expectValidUser(user: any) {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('name');
  expect(user).toHaveProperty('email');
  expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
}

export function expectValidOrder(order: any) {
  expect(order).toHaveProperty('id');
  expect(order).toHaveProperty('user_id');
  expect(order).toHaveProperty('total');
  expect(order.total).toBeGreaterThan(0);
}

// Usage
test('should create valid user', async () => {
  const client = container.resolve<AppSheetClientInterface>('AppSheetClient');
  const user = await client.addOne('users', { ... });

  expectValidUser(user);
});
```

---

## 6. Test Performance Optimization

### 6.1 Container Reuse

```typescript
// Slow approach (create container per test)
describe('Slow Tests', () => {
  test('test 1', () => {
    const container = setupTestContainer({ ... });  // New container
    // ...
  });

  test('test 2', () => {
    const container = setupTestContainer({ ... });  // New container
    // ...
  });
});

// Fast approach (reuse container, reset state)
describe('Fast Tests', () => {
  let container: DependencyContainer;

  beforeAll(() => {
    container = setupTestContainer({ ... });  // Create once
  });

  beforeEach(() => {
    // Reset database state only
    const client = container.resolve(MockAppSheetClient);
    client.clearDatabase();
  });

  afterAll(() => {
    container.reset();  // Cleanup once
  });

  test('test 1', () => { /* ... */ });
  test('test 2', () => { /* ... */ });
});
```

### 6.2 Parallel Test Execution

```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  maxWorkers: '50%',  // Run tests in parallel
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['./tests/setup.ts']
};
```

```typescript
// tests/setup.ts
import 'reflect-metadata';

// Global test timeout
jest.setTimeout(10000);

// Global beforeEach (runs for ALL tests)
beforeEach(() => {
  // Reset global container
  const { container } = require('tsyringe');
  container.reset();
});
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main, develop, staging]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json

  e2e:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20.x

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        env:
          APPSHEET_APP_ID: ${{ secrets.APPSHEET_APP_ID }}
          APPSHEET_ACCESS_KEY: ${{ secrets.APPSHEET_ACCESS_KEY }}
        run: npm run test:e2e
```

### 7.2 Test Scripts (package.json)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## 8. Coverage Goals

### 8.1 Coverage Targets

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/client/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/di/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
```

### 8.2 Coverage Monitoring

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

---

## 9. Troubleshooting Tests

### 9.1 Common Issues

**Problem: Tests interfere with each other**
```typescript
// Solution: Reset container in afterEach
afterEach(() => {
  container.reset();
});
```

**Problem: reflect-metadata errors**
```typescript
// Solution: Import reflect-metadata first in test setup
// tests/setup.ts
import 'reflect-metadata';
```

**Problem: Slow tests**
```typescript
// Solution: Use shared container with state reset
beforeAll(() => {
  container = setupTestContainer({ ... });
});

beforeEach(() => {
  const client = container.resolve(MockAppSheetClient);
  client.clearDatabase();
});
```

**Problem: Memory leaks**
```typescript
// Solution: Always reset container
afterEach(() => {
  container.reset();
});

afterAll(() => {
  container.clearInstances();
});
```

---

Diese Testing-Strategie stellt sicher, dass die DI-Integration vollständig getestet wird, ohne die Performance oder Rückwärtskompatibilität zu beeinträchtigen! 🎯
