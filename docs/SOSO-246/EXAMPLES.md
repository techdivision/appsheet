# TSyringe DI Integration - Code Examples

**Ticket:** SOSO-246
**Projekt:** @techdivision/appsheet

---

## 1. Basic Usage Examples

### 1.1 Production Setup - Real Client

```typescript
// src/app.ts
import 'reflect-metadata';
import { setupProductionContainer } from '@techdivision/appsheet';

// Setup DI Container
const container = setupProductionContainer({
  appId: process.env.APPSHEET_APP_ID!,
  applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
  runAsUserEmail: 'system@example.com'
});

// Resolve client
const client = container.resolve<AppSheetClientInterface>('AppSheetClient');

// Use client
async function main() {
  const users = await client.findAll('Users');
  console.log(`Found ${users.length} users`);

  const newUser = await client.addOne('Users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Created user:', newUser);
}

main();
```

### 1.2 Test Setup - Mock Client

```typescript
// tests/integration/users.test.ts
import 'reflect-metadata';
import { setupTestContainer, MockDataProvider } from '@techdivision/appsheet';

// Custom test data
class UsersTestData implements MockDataProvider {
  getTables(): Map<string, TableData> {
    return new Map([
      ['Users', {
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
          { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' }
        ],
        keyField: 'id'
      }]
    ]);
  }
}

describe('User Management', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new UsersTestData()
    );
  });

  afterEach(() => {
    container.reset();
  });

  test('should list all users', async () => {
    const client = container.resolve<AppSheetClientInterface>('AppSheetClient');
    const users = await client.findAll('Users');

    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('Alice');
    expect(users[1].name).toBe('Bob');
  });

  test('should add new user', async () => {
    const client = container.resolve<AppSheetClientInterface>('AppSheetClient');

    const newUser = await client.addOne('Users', {
      id: '3',
      name: 'Charlie',
      email: 'charlie@example.com',
      role: 'user'
    });

    expect(newUser.id).toBe('3');

    const users = await client.findAll('Users');
    expect(users).toHaveLength(3);
  });
});
```

---

## 2. Schema-Based Examples

### 2.1 Production with Schema

```typescript
// src/app-with-schema.ts
import 'reflect-metadata';
import { container, SchemaLoader, SchemaManager } from '@techdivision/appsheet';

// Load schema
const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');

// Register schema
container.register('SchemaConfig', { useValue: schema });

// Setup real client
container.register<AppSheetConfig>('AppSheetConfig', {
  useValue: {
    appId: process.env.APPSHEET_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!
  }
});

container.register<AppSheetClientInterface>('AppSheetClient', {
  useClass: AppSheetClient
});

// Resolve SchemaManager
const db = container.resolve(SchemaManager);

// Use typed table clients
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

async function main() {
  const usersTable = db.table<User>('worklog', 'users');

  const users = await usersTable.findAll();
  console.log('All users:', users);

  const admins = await usersTable.find('[role] = "admin"');
  console.log('Admin users:', admins);

  await usersTable.add([{
    id: 'new-id',
    name: 'New User',
    email: 'new@example.com',
    role: 'user'
  }]);
}

main();
```

### 2.2 Tests with Schema

```typescript
// tests/integration/schema.test.ts
import 'reflect-metadata';
import { setupTestContainer, SchemaConfig } from '@techdivision/appsheet';

// Test schema
const testSchema: SchemaConfig = {
  connections: {
    main: {
      appId: 'test',
      applicationAccessKey: 'test',
      tables: {
        users: {
          tableName: 'users',
          keyField: 'id',
          fields: {
            id: 'string',
            name: 'string',
            email: 'string',
            role: { type: 'string', enum: ['admin', 'user'] }
          }
        },
        orders: {
          tableName: 'orders',
          keyField: 'id',
          fields: {
            id: 'string',
            user_id: 'string',
            total: 'number',
            status: 'string'
          }
        }
      }
    }
  }
};

// Test data
class SchemaTestData implements MockDataProvider {
  getTables(): Map<string, TableData> {
    return new Map([
      ['users', {
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' }
        ],
        keyField: 'id'
      }],
      ['orders', {
        rows: [
          { id: 'o1', user_id: '1', total: 100, status: 'completed' }
        ],
        keyField: 'id'
      }]
    ]);
  }
}

describe('Schema-based operations', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new SchemaTestData(),
      testSchema
    );
  });

  test('should use SchemaManager with mock data', async () => {
    const { SchemaManager } = await import('@techdivision/appsheet');
    const db = container.resolve(SchemaManager);

    const usersTable = db.table('main', 'users');
    const ordersTable = db.table('main', 'orders');

    const users = await usersTable.findAll();
    const orders = await ordersTable.findAll();

    expect(users).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(orders[0].user_id).toBe(users[0].id);
  });

  test('should validate fields with schema', async () => {
    const { SchemaManager } = await import('@techdivision/appsheet');
    const db = container.resolve(SchemaManager);

    const usersTable = db.table('main', 'users');

    // Valid role
    await expect(
      usersTable.add([{ id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' }])
    ).resolves.toBeDefined();

    // Invalid role (enum validation)
    await expect(
      usersTable.add([{ id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'invalid' }])
    ).rejects.toThrow(ValidationError);
  });
});
```

---

## 3. Advanced Patterns

### 3.1 Multi-Connection Setup

```typescript
// src/multi-connection.ts
import 'reflect-metadata';
import { container, ConnectionManager, ClientFactory } from '@techdivision/appsheet';

// Register factory for real clients
container.register<ClientFactory>('ClientFactory', {
  useFactory: () => (config) => new AppSheetClient(config)
});

// Create manager
const manager = container.resolve(ConnectionManager);

// Register multiple connections
manager.register({
  name: 'worklog',
  appId: process.env.WORKLOG_APP_ID!,
  applicationAccessKey: process.env.WORKLOG_ACCESS_KEY!
});

manager.register({
  name: 'hr',
  appId: process.env.HR_APP_ID!,
  applicationAccessKey: process.env.HR_ACCESS_KEY!
});

manager.register({
  name: 'inventory',
  appId: process.env.INVENTORY_APP_ID!,
  applicationAccessKey: process.env.INVENTORY_ACCESS_KEY!
});

// Use different connections
async function main() {
  const worklogClient = manager.get('worklog');
  const hrClient = manager.get('hr');

  const worklogs = await worklogClient.findAll('worklogs');
  const employees = await hrClient.findAll('employees');

  console.log(`Worklogs: ${worklogs.length}, Employees: ${employees.length}`);

  // Health check
  const health = await manager.healthCheck();
  console.log('Connection health:', health);
}

main();
```

### 3.2 Hybrid Testing (Mock + Real)

```typescript
// tests/integration/hybrid.test.ts
import 'reflect-metadata';
import { container, ConnectionManager } from '@techdivision/appsheet';

describe('Hybrid Testing', () => {
  beforeEach(() => {
    container.reset();

    // Mock client for main operations
    container.register('AppSheetConfig', {
      useValue: { appId: 'test', applicationAccessKey: 'test' }
    });

    container.register<ClientFactory>('ClientFactory', {
      useFactory: (c) => (config) => {
        // Use mock for 'test' connections
        if (config.appId === 'test') {
          c.register('AppSheetConfig', { useValue: config });
          return c.resolve(MockAppSheetClient);
        }
        // Use real client for specific connections
        return new AppSheetClient(config);
      }
    });
  });

  test('should use mock for test data and real for specific service', async () => {
    const manager = container.resolve(ConnectionManager);

    // Register test connection (uses mock)
    manager.register({
      name: 'test',
      appId: 'test',
      applicationAccessKey: 'test'
    });

    // Register real connection (uses real client)
    manager.register({
      name: 'real-service',
      appId: process.env.REAL_APP_ID!,
      applicationAccessKey: process.env.REAL_ACCESS_KEY!
    });

    const testClient = manager.get('test');
    const realClient = manager.get('real-service');

    // testClient is MockAppSheetClient
    expect(testClient.constructor.name).toBe('MockAppSheetClient');

    // realClient is AppSheetClient
    expect(realClient.constructor.name).toBe('AppSheetClient');
  });
});
```

### 3.3 Custom Mock Data Provider

```typescript
// tests/fixtures/ProductionMockData.ts
import { MockDataProvider, TableData } from '@techdivision/appsheet';
import * as fs from 'fs';
import * as yaml from 'yaml';

/**
 * Load mock data from YAML fixtures
 */
export class YamlMockDataProvider implements MockDataProvider {
  constructor(private fixturesPath: string) {}

  getTables(): Map<string, TableData> {
    const content = fs.readFileSync(this.fixturesPath, 'utf-8');
    const fixtures = yaml.parse(content);

    const tables = new Map<string, TableData>();

    for (const [tableName, tableData] of Object.entries(fixtures)) {
      tables.set(tableName, tableData as TableData);
    }

    return tables;
  }
}

/**
 * Generate mock data programmatically
 */
export class GeneratedMockDataProvider implements MockDataProvider {
  getTables(): Map<string, TableData> {
    const tables = new Map<string, TableData>();

    // Generate 100 users
    const users = Array.from({ length: 100 }, (_, i) => ({
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i % 10 === 0 ? 'admin' : 'user'
    }));

    tables.set('users', { rows: users, keyField: 'id' });

    // Generate 500 orders
    const orders = Array.from({ length: 500 }, (_, i) => ({
      id: `order-${i + 1}`,
      user_id: `user-${(i % 100) + 1}`,
      total: Math.floor(Math.random() * 1000),
      status: ['pending', 'completed', 'cancelled'][i % 3]
    }));

    tables.set('orders', { rows: orders, keyField: 'id' });

    return tables;
  }
}

// Usage
describe('Large dataset tests', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new GeneratedMockDataProvider()
    );
  });

  test('should handle large datasets', async () => {
    const client = container.resolve<AppSheetClientInterface>('AppSheetClient');

    const users = await client.findAll('users');
    expect(users).toHaveLength(100);

    const orders = await client.findAll('orders');
    expect(orders).toHaveLength(500);
  });
});
```

### 3.4 Shared vs Isolated Database State

```typescript
// tests/database-isolation.test.ts
import 'reflect-metadata';
import { setupTestContainer, setupIsolatedTestContainer } from '@techdivision/appsheet';

describe('Shared Database State', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    // Singleton MockDatabase - shared across resolves
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' }
    );
  });

  test('should share data between client instances', async () => {
    const client1 = container.resolve(MockAppSheetClient);
    const client2 = container.resolve(MockAppSheetClient);

    // Add data via client1
    await client1.addOne('users', { id: '1', name: 'Alice' });

    // Read via client2 (sees data from client1)
    const users = await client2.findAll('users');
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
  });
});

describe('Isolated Database State', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    // Transient MockDatabase - new instance per resolve
    container = setupIsolatedTestContainer(
      { appId: 'test', applicationAccessKey: 'test' }
    );
  });

  test('should NOT share data between client instances', async () => {
    const client1 = container.resolve(MockAppSheetClient);
    const client2 = container.resolve(MockAppSheetClient);

    // Add data via client1
    await client1.addOne('users', { id: '1', name: 'Alice' });

    // Read via client2 (does NOT see data from client1)
    const users = await client2.findAll('users');
    expect(users).toHaveLength(0);
  });
});
```

---

## 4. Service Layer Examples

### 4.1 Injectable Service with AppSheet Client

```typescript
// src/services/UserService.ts
import { injectable, inject } from 'tsyringe';
import { AppSheetClientInterface } from '@techdivision/appsheet';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

@injectable()
export class UserService {
  constructor(
    @inject('AppSheetClient') private client: AppSheetClientInterface
  ) {}

  async getAllUsers(): Promise<User[]> {
    return this.client.findAll<User>('Users');
  }

  async getUserById(id: string): Promise<User | null> {
    return this.client.findOne<User>('Users', `[id] = "${id}"`);
  }

  async createUser(data: Omit<User, 'id' | 'created_at'>): Promise<User> {
    return this.client.addOne<User>('Users', {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    return this.client.updateOne<User>('Users', { id, ...updates });
  }

  async deleteUser(id: string): Promise<void> {
    await this.client.deleteOne('Users', { id });
  }

  async getAdminUsers(): Promise<User[]> {
    const response = await this.client.find<User>({
      tableName: 'Users',
      selector: '[role] = "admin"'
    });
    return response.rows;
  }
}
```

### 4.2 Testing Injectable Service

```typescript
// tests/services/UserService.test.ts
import 'reflect-meta data';
import { setupTestContainer, MockDataProvider } from '@techdivision/appsheet';
import { UserService } from '../../src/services/UserService';

class UserServiceTestData implements MockDataProvider {
  getTables(): Map<string, TableData> {
    return new Map([
      ['Users', {
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
          { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' }
        ],
        keyField: 'id'
      }]
    ]);
  }
}

describe('UserService', () => {
  let container: DependencyContainer;
  let userService: UserService;

  beforeEach(() => {
    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new UserServiceTestData()
    );

    userService = container.resolve(UserService);
  });

  afterEach(() => {
    container.reset();
  });

  test('should get all users', async () => {
    const users = await userService.getAllUsers();

    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('Alice');
  });

  test('should get user by id', async () => {
    const user = await userService.getUserById('1');

    expect(user).toBeDefined();
    expect(user?.name).toBe('Alice');
  });

  test('should create new user', async () => {
    const newUser = await userService.createUser({
      name: 'Charlie',
      email: 'charlie@example.com',
      role: 'user'
    });

    expect(newUser.id).toBeDefined();
    expect(newUser.name).toBe('Charlie');

    const users = await userService.getAllUsers();
    expect(users).toHaveLength(3);
  });

  test('should get only admin users', async () => {
    const admins = await userService.getAdminUsers();

    expect(admins).toHaveLength(1);
    expect(admins[0].role).toBe('admin');
  });

  test('should update user', async () => {
    const updated = await userService.updateUser('2', { role: 'admin' });

    expect(updated.role).toBe('admin');

    const admins = await userService.getAdminUsers();
    expect(admins).toHaveLength(2);
  });

  test('should delete user', async () => {
    await userService.deleteUser('1');

    const users = await userService.getAllUsers();
    expect(users).toHaveLength(1);
  });
});
```

---

## 5. MCP Server Integration

### 5.1 MCP Server with DI

```typescript
// src/mcp-server.ts
import 'reflect-metadata';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProductionContainer, SchemaLoader } from '@techdivision/appsheet';

// Load schema
const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');

// Setup DI container
const container = setupProductionContainer(
  {
    appId: process.env.APPSHEET_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!
  },
  schema
);

// Create MCP server
const server = new Server(
  {
    name: 'appsheet-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
    }
  }
);

// Register tools using DI-resolved services
const { SchemaManager } = await import('@techdivision/appsheet');
const db = container.resolve(SchemaManager);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const connections = db.getConnections();

  return {
    tools: connections.flatMap(conn => {
      const tables = db.getTables(conn);
      return tables.map(table => ({
        name: `${conn}_${table}_list`,
        description: `List all records from ${table} in ${conn}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }));
    })
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const [conn, table, action] = request.params.name.split('_');

  const tableClient = db.table(conn, table);

  if (action === 'list') {
    const records = await tableClient.findAll();
    return {
      content: [{ type: 'text', text: JSON.stringify(records, null, 2) }]
    };
  }

  throw new Error(`Unknown action: ${action}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 5.2 MCP Server Tests with DI

```typescript
// tests/mcp-server.test.ts
import 'reflect-metadata';
import { setupTestContainer, MockDataProvider } from '@techdivision/appsheet';

class MCPTestData implements MockDataProvider {
  getTables(): Map<string, TableData> {
    return new Map([
      ['users', {
        rows: [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' }
        ],
        keyField: 'id'
      }]
    ]);
  }
}

describe('MCP Server with DI', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    const schema = {
      connections: {
        main: {
          appId: 'test',
          applicationAccessKey: 'test',
          tables: {
            users: {
              tableName: 'users',
              keyField: 'id',
              fields: { id: 'string', name: 'string' }
            }
          }
        }
      }
    };

    container = setupTestContainer(
      { appId: 'test', applicationAccessKey: 'test' },
      new MCPTestData(),
      schema
    );
  });

  test('should handle list_tools request', async () => {
    const { SchemaManager } = await import('@techdivision/appsheet');
    const db = container.resolve(SchemaManager);

    const connections = db.getConnections();
    expect(connections).toContain('main');

    const tables = db.getTables('main');
    expect(tables).toContain('users');
  });

  test('should handle call_tool request', async () => {
    const { SchemaManager } = await import('@techdivision/appsheet');
    const db = container.resolve(SchemaManager);

    const usersTable = db.table('main', 'users');
    const records = await usersTable.findAll();

    expect(records).toHaveLength(2);
    expect(records[0].name).toBe('Alice');
  });
});
```

---

## 6. Troubleshooting Examples

### 6.1 Missing reflect-metadata

**Problem:**
```
Error: Reflect.getMetadata is not a function
```

**Solution:**
```typescript
// WICHTIG: reflect-metadata muss als ERSTES importiert werden
import 'reflect-metadata';  // ⬅ MUSS ganz oben stehen

import { container } from '@techdivision/appsheet';
// ... rest of imports
```

### 6.2 Circular Dependencies

**Problem:**
```
Error: Cannot resolve dependency
```

**Solution:**
```typescript
// Verwende @inject() mit delay oder lazy
import { injectable, inject, delay } from 'tsyringe';

@injectable()
class ServiceA {
  constructor(
    @inject(delay(() => ServiceB)) private serviceB: ServiceB
  ) {}
}

@injectable()
class ServiceB {
  constructor(
    @inject(delay(() => ServiceA)) private serviceA: ServiceA
  ) {}
}
```

### 6.3 Container Lifecycle in Tests

**Problem:** Tests beeinflussen sich gegenseitig (shared state).

**Solution:**
```typescript
describe('Isolated Tests', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    // Erstelle NEUEN Child Container pro Test
    container = setupTestContainer({ appId: 'test', applicationAccessKey: 'test' });
  });

  afterEach(() => {
    // WICHTIG: Reset nach jedem Test
    container.reset();
  });

  test('test 1', async () => {
    // Isolierter State
  });

  test('test 2', async () => {
    // Isolierter State
  });
});
```

---

## 7. Performance Optimization

### 7.1 Lazy Loading

```typescript
// src/services/OptimizedService.ts
import { injectable, inject, singleton } from 'tsyringe';

@injectable()
@singleton()  // Nur eine Instanz erstellen
export class HeavyService {
  private cache: Map<string, any> = new Map();

  constructor(
    @inject('AppSheetClient') private client: AppSheetClientInterface
  ) {}

  async getDataWithCache(key: string): Promise<any> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const data = await this.client.findAll(key);
    this.cache.set(key, data);
    return data;
  }
}
```

### 7.2 Scoped Container für Performance

```typescript
// tests/performance.test.ts
import 'reflect-metadata';
import { container } from 'tsyringe';

describe('Performance Tests', () => {
  test('should resolve quickly with scoped container', async () => {
    const childContainer = container.createChildContainer();

    const start = performance.now();

    // Register nur einmal
    childContainer.register('AppSheetConfig', {
      useValue: { appId: 'test', applicationAccessKey: 'test' }
    });

    // Resolve multiple times (fast)
    for (let i = 0; i < 1000; i++) {
      childContainer.resolve(MockAppSheetClient);
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);  // < 100ms für 1000 resolves

    childContainer.reset();
  });
});
```

---

Diese Examples decken alle wichtigen Use Cases ab und zeigen konkrete Implementierungen für Production und Tests! 🚀
