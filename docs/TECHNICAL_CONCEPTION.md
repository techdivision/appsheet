# AppSheet TypeScript Library - API Konzept

## Übersicht

Diese Library bietet eine generische, typsichere Schnittstelle für CRUD-Operationen auf beliebige AppSheet-Tabellen. Sie ist speziell für die Verwendung in MCP-Servern und internen Projekten optimiert.

## Architektur

```
src/
├── client/
│   ├── AppSheetClient.ts      # Hauptklasse für API-Operationen
│   └── index.ts
├── types/
│   ├── config.ts              # Konfigurationstypen
│   ├── operations.ts          # CRUD-Operationstypen
│   ├── responses.ts           # API-Response-Typen
│   └── index.ts
├── utils/
│   ├── filters.ts             # Filter-Builder für Queries
│   ├── validators.ts          # Input-Validierung
│   ├── transformers.ts        # Daten-Transformationen
│   └── index.ts
└── index.ts
```

## Kerntypen

### 1. Konfiguration

```typescript
interface AppSheetConfig {
  appId: string;                    // AppSheet App-ID
  applicationAccessKey: string;     // API Access Key
  baseUrl?: string;                 // Optional: Custom API URL
  timeout?: number;                 // Optional: Request Timeout (default: 30000ms)
  retryAttempts?: number;          // Optional: Anzahl Wiederholungsversuche (default: 3)
}
```

### 2. CRUD-Operationen

#### Add (Create)
```typescript
interface AddOptions<T = Record<string, any>> {
  tableName: string;
  rows: T[];                        // Ein oder mehrere Datensätze
  properties?: {
    Locale?: string;
    Location?: string;
    Timezone?: string;
    UserId?: string;
    RunAsUserEmail?: string;
  };
}

interface AddResponse<T = Record<string, any>> {
  rows: T[];                        // Erstellte Datensätze mit Server-generierten Feldern
  warnings?: string[];
}
```

#### Find (Read)
```typescript
interface FindOptions {
  tableName: string;
  selector?: string;                // SQL-ähnlicher Filter (z.B. "_RowNumber > 10")
  properties?: {
    Locale?: string;
    Location?: string;
    Timezone?: string;
    UserId?: string;
    Selector?: string;              // Alternative zu top-level selector
  };
}

interface FindResponse<T = Record<string, any>> {
  rows: T[];
  warnings?: string[];
}
```

#### Update
```typescript
interface UpdateOptions<T = Record<string, any>> {
  tableName: string;
  rows: T[];                        // Datensätze mit Key-Feldern zum Update
  properties?: {
    Locale?: string;
    Location?: string;
    Timezone?: string;
    UserId?: string;
    RunAsUserEmail?: string;
  };
}

interface UpdateResponse<T = Record<string, any>> {
  rows: T[];                        // Aktualisierte Datensätze
  warnings?: string[];
}
```

#### Delete
```typescript
interface DeleteOptions<T = Record<string, any>> {
  tableName: string;
  rows: T[];                        // Datensätze mit Key-Feldern zum Löschen
  properties?: {
    Locale?: string;
    Location?: string;
    Timezone?: string;
    UserId?: string;
    RunAsUserEmail?: string;
  };
}

interface DeleteResponse {
  success: boolean;
  deletedCount: number;
  warnings?: string[];
}
```

## AppSheetClient API

### Hauptklasse

```typescript
class AppSheetClient {
  constructor(config: AppSheetConfig);

  // CRUD-Operationen
  add<T = Record<string, any>>(options: AddOptions<T>): Promise<AddResponse<T>>;
  find<T = Record<string, any>>(options: FindOptions): Promise<FindResponse<T>>;
  update<T = Record<string, any>>(options: UpdateOptions<T>): Promise<UpdateResponse<T>>;
  delete<T = Record<string, any>>(options: DeleteOptions<T>): Promise<DeleteResponse>;

  // Convenience-Methoden
  findOne<T = Record<string, any>>(tableName: string, selector: string): Promise<T | null>;
  findAll<T = Record<string, any>>(tableName: string): Promise<T[]>;
  addOne<T = Record<string, any>>(tableName: string, row: T): Promise<T>;
  updateOne<T = Record<string, any>>(tableName: string, row: T): Promise<T>;
  deleteOne<T = Record<string, any>>(tableName: string, row: T): Promise<boolean>;
}
```

### Verwendungsbeispiel

```typescript
import { AppSheetClient } from '@yourorg/appsheet';

const client = new AppSheetClient({
  appId: 'your-app-id',
  applicationAccessKey: 'your-access-key'
});

// Create
const newUser = await client.addOne('Users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Read
const users = await client.findAll<User>('Users');
const john = await client.findOne<User>('Users', '[Email] = "john@example.com"');

// Update
await client.updateOne('Users', {
  id: john.id,
  name: 'John Smith'
});

// Delete
await client.deleteOne('Users', { id: john.id });
```

## Helper-Utilities

### 1. Filter-Builder

```typescript
class FilterBuilder {
  // Methoden für typsichere Filter-Erstellung
  equals(field: string, value: any): FilterBuilder;
  notEquals(field: string, value: any): FilterBuilder;
  greaterThan(field: string, value: number | Date): FilterBuilder;
  lessThan(field: string, value: number | Date): FilterBuilder;
  contains(field: string, value: string): FilterBuilder;
  in(field: string, values: any[]): FilterBuilder;
  isNull(field: string): FilterBuilder;
  isNotNull(field: string): FilterBuilder;
  and(...filters: FilterBuilder[]): FilterBuilder;
  or(...filters: FilterBuilder[]): FilterBuilder;
  build(): string;
}

// Verwendung
const filter = new FilterBuilder()
  .equals('Status', 'Active')
  .and(
    new FilterBuilder().greaterThan('CreatedDate', new Date('2025-01-01'))
  )
  .build();
// Ergebnis: "[Status] = 'Active' AND [CreatedDate] > '2025-01-01'"
```

### 2. Typed Table Client

```typescript
// Für typsichere Operationen auf spezifischen Tabellen
class TypedTableClient<T extends Record<string, any>> {
  constructor(
    private client: AppSheetClient,
    private tableName: string
  );

  add(rows: T[]): Promise<T[]>;
  find(selector?: string): Promise<T[]>;
  findOne(selector: string): Promise<T | null>;
  update(rows: Partial<T>[]): Promise<T[]>;
  delete(rows: Pick<T, keyof T>[]): Promise<boolean>;
}

// Verwendung
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const usersTable = new TypedTableClient<User>(client, 'Users');
const users = await usersTable.find('[Status] = "Active"');
```

### 3. Batch-Operationen

```typescript
class BatchOperations {
  constructor(private client: AppSheetClient);

  // Batch-Add mit automatischer Chunk-Aufteilung
  batchAdd<T>(
    tableName: string,
    rows: T[],
    chunkSize?: number
  ): Promise<T[]>;

  // Batch-Update
  batchUpdate<T>(
    tableName: string,
    rows: T[],
    chunkSize?: number
  ): Promise<T[]>;

  // Batch-Delete
  batchDelete<T>(
    tableName: string,
    rows: T[],
    chunkSize?: number
  ): Promise<boolean>;
}
```

### 4. Error-Handling

```typescript
class AppSheetError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  );
}

// Spezifische Error-Typen
class AuthenticationError extends AppSheetError {}
class ValidationError extends AppSheetError {}
class NotFoundError extends AppSheetError {}
class RateLimitError extends AppSheetError {}
```

### 5. Caching (Optional)

```typescript
interface CacheOptions {
  ttl?: number;                     // Time to live in ms
  maxSize?: number;                 // Max cache entries
}

class CachedAppSheetClient extends AppSheetClient {
  constructor(config: AppSheetConfig, cacheOptions?: CacheOptions);

  // Überschreibt find mit Caching
  find<T>(options: FindOptions): Promise<FindResponse<T>>;

  // Cache-Verwaltung
  clearCache(tableName?: string): void;
  getCacheStats(): CacheStats;
}
```

## API-Endpoint-Struktur

### Base URL
```
https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
```

### HTTP Headers
```
ApplicationAccessKey: <your-access-key>
Content-Type: application/json
```

### Request Body (generisch)
```json
{
  "Action": "Add" | "Find" | "Edit" | "Delete",
  "Properties": {
    "Locale": "de-DE",
    "Location": "47.6740,9.1708",
    "Timezone": "Europe/Berlin",
    "UserId": "user@example.com",
    "RunAsUserEmail": "user@example.com",
    "Selector": "SQL-like filter expression"
  },
  "Rows": [
    { /* row data */ }
  ]
}
```

### Response Format
```json
{
  "Rows": [
    { /* returned row data */ }
  ],
  "Warnings": ["optional warnings"]
}
```

## Erweiterbarkeit

### Plugin-System (Optional)
```typescript
interface Plugin {
  name: string;
  beforeRequest?: (config: RequestConfig) => RequestConfig;
  afterResponse?: (response: any) => any;
  onError?: (error: Error) => void;
}

class AppSheetClient {
  use(plugin: Plugin): void;
}
```

### Event-System
```typescript
class AppSheetClient extends EventEmitter {
  // Events: 'request', 'response', 'error', 'retry'
}
```

## Table Schema Management

Ein zentrales Design-Problem: Wie definieren und verwalten wir Tabellennamen und -strukturen in konkreten Projekten?

### Ansatz 1: Runtime Schema Loading (Empfohlen)

**Vorteil**: Schema-Änderungen erfordern keine Code-Regeneration, nur Anpassung der JSON/YAML-Datei.

#### Schema-Definition in JSON/YAML

```yaml
# config/appsheet-schema.yaml
connections:
  worklog:
    appId: ${APPSHEET_WORKLOG_APP_ID}
    applicationAccessKey: ${APPSHEET_WORKLOG_ACCESS_KEY}
    tables:
      worklogs:
        tableName: worklog
        keyField: id
        fields:
          id: string
          userId: string
          date: string
          hours: number
          description: string
          projectKey: string

      issues:
        tableName: extract_issue
        keyField: key
        fields:
          key: string
          summary: string
          status: string
          assignee: string
          createdAt: string

  hr:
    appId: ${APPSHEET_HR_APP_ID}
    applicationAccessKey: ${APPSHEET_HR_ACCESS_KEY}
    tables:
      employees:
        tableName: employees
        keyField: id
        fields:
          id: string
          name: string
          email: string
          department: string
          hireDate: string

      departments:
        tableName: departments
        keyField: id
        fields:
          id: string
          name: string
          manager: string
```

Oder als JSON:

```json
{
  "connections": {
    "worklog": {
      "appId": "${APPSHEET_WORKLOG_APP_ID}",
      "applicationAccessKey": "${APPSHEET_WORKLOG_ACCESS_KEY}",
      "tables": {
        "worklogs": {
          "tableName": "worklog",
          "keyField": "id",
          "fields": {
            "id": "string",
            "userId": "string",
            "date": "string",
            "hours": "number",
            "description": "string",
            "projectKey": "string"
          }
        },
        "issues": {
          "tableName": "extract_issue",
          "keyField": "key",
          "fields": {
            "key": "string",
            "summary": "string",
            "status": "string"
          }
        }
      }
    }
  }
}
```

#### Schema Loader (in der Library)

```typescript
// src/utils/schemaLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required?: boolean;
  enum?: string[];
  description?: string;
}

export interface TableDefinition {
  tableName: string;
  keyField: string;
  fields: Record<string, string | FieldDefinition>;
}

export interface ConnectionDefinition {
  appId: string;
  applicationAccessKey: string;
  baseUrl?: string;
  timeout?: number;
  tables: Record<string, TableDefinition>;
}

export interface SchemaConfig {
  connections: Record<string, ConnectionDefinition>;
}

export class SchemaLoader {
  /**
   * Lädt Schema aus JSON-Datei
   */
  static fromJson(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = JSON.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Lädt Schema aus YAML-Datei
   */
  static fromYaml(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = yaml.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Lädt Schema aus Objekt (für Tests oder programmatische Definition)
   */
  static fromObject(schema: SchemaConfig): SchemaConfig {
    return this.resolveEnvVars(schema);
  }

  /**
   * Ersetzt ${VAR_NAME} durch Umgebungsvariablen
   */
  private static resolveEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const value = process.env[varName];
        if (!value) {
          throw new Error(`Environment variable ${varName} is not defined`);
        }
        return value;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvVars(item));
    }

    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveEnvVars(value);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Validiert Schema-Struktur
   */
  static validate(schema: SchemaConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema.connections || typeof schema.connections !== 'object') {
      errors.push('Schema must have "connections" object');
      return { valid: false, errors };
    }

    for (const [connName, conn] of Object.entries(schema.connections)) {
      if (!conn.appId) {
        errors.push(`Connection "${connName}": missing appId`);
      }
      if (!conn.applicationAccessKey) {
        errors.push(`Connection "${connName}": missing applicationAccessKey`);
      }
      if (!conn.tables || typeof conn.tables !== 'object') {
        errors.push(`Connection "${connName}": missing or invalid tables`);
        continue;
      }

      for (const [tableName, table] of Object.entries(conn.tables)) {
        if (!table.tableName) {
          errors.push(`Connection "${connName}", table "${tableName}": missing tableName`);
        }
        if (!table.keyField) {
          errors.push(`Connection "${connName}", table "${tableName}": missing keyField`);
        }
        if (!table.fields || typeof table.fields !== 'object') {
          errors.push(`Connection "${connName}", table "${tableName}": missing or invalid fields`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

#### Schema Manager (in der Library)

```typescript
// src/utils/schemaManager.ts
export class SchemaManager {
  private schema: SchemaConfig;
  private connectionManager: ConnectionManager;
  private tableClients: Map<string, Map<string, any>> = new Map();

  constructor(schema: SchemaConfig) {
    const validation = SchemaLoader.validate(schema);
    if (!validation.valid) {
      throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
    }

    this.schema = schema;
    this.connectionManager = new ConnectionManager();
    this.initialize();
  }

  /**
   * Initialisiert alle Connections und Table Clients
   */
  private initialize(): void {
    for (const [connName, connDef] of Object.entries(this.schema.connections)) {
      // Registriere Connection
      this.connectionManager.register({
        name: connName,
        appId: connDef.appId,
        applicationAccessKey: connDef.applicationAccessKey,
        baseUrl: connDef.baseUrl,
        timeout: connDef.timeout,
      });

      // Erstelle Table Clients für diese Connection
      const tables = new Map();
      for (const [tableName, tableDef] of Object.entries(connDef.tables)) {
        const client = this.connectionManager.get(connName);
        tables.set(tableName, new DynamicTable(client, tableDef));
      }
      this.tableClients.set(connName, tables);
    }
  }

  /**
   * Gibt einen Table Client zurück
   */
  table<T = Record<string, any>>(connectionName: string, tableName: string): DynamicTable<T> {
    const connection = this.tableClients.get(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    const table = connection.get(tableName);
    if (!table) {
      throw new Error(
        `Table "${tableName}" not found in connection "${connectionName}". ` +
        `Available tables: ${[...connection.keys()].join(', ')}`
      );
    }

    return table;
  }

  /**
   * Gibt alle verfügbaren Connections zurück
   */
  getConnections(): string[] {
    return [...this.tableClients.keys()];
  }

  /**
   * Gibt alle verfügbaren Tables einer Connection zurück
   */
  getTables(connectionName: string): string[] {
    const connection = this.tableClients.get(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }
    return [...connection.keys()];
  }

  /**
   * Gibt Connection Manager zurück (für advanced use cases)
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Reloaded Schema (nützlich für Hot-Reloading)
   */
  reload(schema: SchemaConfig): void {
    this.tableClients.clear();
    this.connectionManager.clear();
    this.schema = schema;
    this.initialize();
  }
}
```

#### Dynamic Table Client (in der Library)

```typescript
// src/client/dynamicTable.ts
export class DynamicTable<T = Record<string, any>> {
  constructor(
    private client: AppSheetClient,
    private definition: TableDefinition
  ) {}

  async findAll(): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
    });
    return result.rows;
  }

  async findOne(selector: string): Promise<T | null> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows[0] || null;
  }

  async find(selector?: string): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows;
  }

  async add(rows: Partial<T>[]): Promise<T[]> {
    // Optional: Runtime validation basierend auf schema.fields
    this.validateRows(rows);

    const result = await this.client.add<T>({
      tableName: this.definition.tableName,
      rows: rows as T[],
    });
    return result.rows;
  }

  async update(rows: Partial<T>[]): Promise<T[]> {
    this.validateRows(rows);

    const result = await this.client.update<T>({
      tableName: this.definition.tableName,
      rows: rows as T[],
    });
    return result.rows;
  }

  async delete(keys: Partial<T>[]): Promise<boolean> {
    await this.client.delete({
      tableName: this.definition.tableName,
      rows: keys,
    });
    return true;
  }

  /**
   * Query Builder
   */
  query(): DynamicQueryBuilder<T> {
    return new DynamicQueryBuilder<T>(this.client, this.definition.tableName);
  }

  /**
   * Gibt Table-Definition zurück
   */
  getDefinition(): TableDefinition {
    return this.definition;
  }

  /**
   * Runtime Validation basierend auf Schema
   */
  private validateRows(rows: Partial<T>[]): void {
    for (const row of rows) {
      for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
        const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
        const isRequired = typeof fieldDef === 'object' && fieldDef.required;
        const value = (row as any)[fieldName];

        // Check required fields
        if (isRequired && (value === undefined || value === null)) {
          throw new Error(
            `Field "${fieldName}" is required in table "${this.definition.tableName}"`
          );
        }

        // Type validation (basic)
        if (value !== undefined && value !== null) {
          const actualType = typeof value;
          if (fieldType === 'number' && actualType !== 'number') {
            throw new Error(
              `Field "${fieldName}" must be a number, got ${actualType}`
            );
          }
          if (fieldType === 'boolean' && actualType !== 'boolean') {
            throw new Error(
              `Field "${fieldName}" must be a boolean, got ${actualType}`
            );
          }
          // string, array, object validations...
        }

        // Enum validation
        if (typeof fieldDef === 'object' && fieldDef.enum && value) {
          if (!fieldDef.enum.includes(value)) {
            throw new Error(
              `Field "${fieldName}" must be one of: ${fieldDef.enum.join(', ')}`
            );
          }
        }
      }
    }
  }
}
```

#### Verwendung im Projekt

```typescript
// src/db/index.ts
import { SchemaLoader, SchemaManager } from '@yourorg/appsheet';
import * as path from 'path';

// Schema beim Start laden
const schemaPath = path.join(__dirname, '../config/appsheet-schema.yaml');
const schema = SchemaLoader.fromYaml(schemaPath);
export const db = new SchemaManager(schema);

// Verwendung im MCP-Server:
import { db } from './db';

// Typsafe usage (optional TypeScript interface)
interface Worklog {
  id: string;
  userId: string;
  date: string;
  hours: number;
  description: string;
}

// Zugriff auf Tables
const worklogs = await db.table<Worklog>('worklog', 'worklogs').findAll();
const issues = await db.table('worklog', 'issues').findAll();
const employees = await db.table('hr', 'employees').findAll();

// Query Builder
const activeWorklogs = await db
  .table<Worklog>('worklog', 'worklogs')
  .query()
  .where('date', '>=', '2025-01-01')
  .execute();
```

#### Convenience Wrapper (optional)

Für einfacheren Zugriff kann man im Projekt einen Wrapper erstellen:

```typescript
// src/db/tables.ts
import { db } from './index';

// Type definitions (optional, für bessere IDE-Unterstützung)
export interface Worklog {
  id: string;
  userId: string;
  date: string;
  hours: number;
  description: string;
}

export interface Issue {
  key: string;
  summary: string;
  status: string;
}

// Wrapper functions
export const worklogDb = {
  worklogs: () => db.table<Worklog>('worklog', 'worklogs'),
  issues: () => db.table<Issue>('worklog', 'issues'),
};

export const hrDb = {
  employees: () => db.table('hr', 'employees'),
  departments: () => db.table('hr', 'departments'),
};

// Verwendung:
import { worklogDb, hrDb } from './db/tables';

const worklogs = await worklogDb.worklogs().findAll();
const issues = await worklogDb.issues().findAll();
```

#### Schema Hot-Reloading (Development)

```typescript
// src/db/watcher.ts
import * as fs from 'fs';
import { db } from './index';

export function watchSchema(schemaPath: string) {
  fs.watch(schemaPath, (eventType) => {
    if (eventType === 'change') {
      console.log('Schema changed, reloading...');
      try {
        const newSchema = SchemaLoader.fromYaml(schemaPath);
        db.reload(newSchema);
        console.log('Schema reloaded successfully');
      } catch (error) {
        console.error('Failed to reload schema:', error);
      }
    }
  });
}

// In development mode:
if (process.env.NODE_ENV === 'development') {
  watchSchema(schemaPath);
}
```

#### Schema Generation & Inspection

**Problem**: Wie erstellt und aktualisiert man das Schema ohne alles manuell zu tippen?

**Lösung**: CLI Tool zur automatischen Schema-Generierung durch Introspection der AppSheet API.

##### CLI Tool (in der Library)

```typescript
// src/cli/schemaInspector.ts
export class SchemaInspector {
  constructor(private client: AppSheetClient) {}

  /**
   * Inspiziert eine AppSheet App und gibt verfügbare Tabellen zurück
   */
  async inspectApp(): Promise<string[]> {
    // AppSheet API hat keinen direkten "list tables" endpoint,
    // aber wir können über Error-Messages oder bekannte System-Tabellen
    // oder durch manuelle Eingabe arbeiten

    // Option 1: User gibt Tabellennamen an
    // Option 2: Wir versuchen bekannte Tabellen (über Try/Error)
    // Option 3: User hat bereits Liste aus AppSheet UI

    return []; // Implementierung abhängig von AppSheet API capabilities
  }

  /**
   * Inspiziert eine spezifische Tabelle und ermittelt Felder
   */
  async inspectTable(tableName: string): Promise<TableInspectionResult> {
    try {
      // Fetch ein paar Zeilen um Feldtypen zu ermitteln
      const result = await this.client.find({
        tableName,
        selector: '1=1', // Limitierung könnte sinnvoll sein
      });

      if (result.rows.length === 0) {
        return {
          tableName,
          keyField: 'id', // Default, muss ggf. manuell angepasst werden
          fields: {},
          warning: 'Table is empty, could not infer field types',
        };
      }

      // Analysiere erste Zeile für Feldtypen
      const sampleRow = result.rows[0];
      const fields: Record<string, string> = {};

      for (const [key, value] of Object.entries(sampleRow)) {
        fields[key] = this.inferType(value);
      }

      return {
        tableName,
        keyField: this.guessKeyField(sampleRow),
        fields,
      };
    } catch (error) {
      throw new Error(`Failed to inspect table "${tableName}": ${error.message}`);
    }
  }

  /**
   * Ermittelt Typ eines Wertes
   */
  private inferType(value: any): string {
    if (value === null || value === undefined) {
      return 'string'; // Default
    }

    const type = typeof value;
    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (type === 'object') return 'object';

    // Check if string looks like a date
    if (typeof value === 'string') {
      // ISO date format
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return 'date';
      }
    }

    return 'string';
  }

  /**
   * Versucht das Key-Feld zu erraten
   */
  private guessKeyField(row: Record<string, any>): string {
    // Typische Key-Feld-Namen
    const commonKeys = ['id', 'key', 'ID', 'Key', '_RowNumber'];

    for (const key of commonKeys) {
      if (key in row) {
        return key;
      }
    }

    // Fallback: erstes Feld
    return Object.keys(row)[0] || 'id';
  }

  /**
   * Generiert Schema für mehrere Tabellen
   */
  async generateSchema(
    connectionName: string,
    tableNames: string[]
  ): Promise<ConnectionDefinition> {
    const tables: Record<string, TableDefinition> = {};

    for (const tableName of tableNames) {
      console.log(`Inspecting table: ${tableName}...`);
      const inspection = await this.inspectTable(tableName);

      tables[this.toSchemaName(tableName)] = {
        tableName: inspection.tableName,
        keyField: inspection.keyField,
        fields: inspection.fields,
      };

      if (inspection.warning) {
        console.warn(`  Warning: ${inspection.warning}`);
      }
    }

    return {
      appId: '${APPSHEET_APP_ID}', // Placeholder
      applicationAccessKey: '${APPSHEET_ACCESS_KEY}', // Placeholder
      tables,
    };
  }

  /**
   * Konvertiert Tabellenname zu Schema-Namen (camelCase)
   */
  private toSchemaName(tableName: string): string {
    // "extract_user" -> "users"
    // "worklog" -> "worklogs"
    return tableName
      .replace(/^extract_/, '')
      .replace(/_/g, '')
      .toLowerCase() + 's';
  }
}

interface TableInspectionResult {
  tableName: string;
  keyField: string;
  fields: Record<string, string>;
  warning?: string;
}
```

##### CLI Commands

```typescript
// src/cli/commands.ts
import { Command } from 'commander';
import * as yaml from 'yaml';
import * as fs from 'fs';

export function createCLI() {
  const program = new Command();

  program
    .name('appsheet')
    .description('AppSheet Schema Management CLI')
    .version('1.0.0');

  // Command: init
  program
    .command('init')
    .description('Initialize a new schema file')
    .option('-o, --output <path>', 'Output file path', 'config/appsheet-schema.yaml')
    .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
    .action(async (options) => {
      const schema: SchemaConfig = {
        connections: {
          default: {
            appId: '${APPSHEET_APP_ID}',
            applicationAccessKey: '${APPSHEET_ACCESS_KEY}',
            tables: {},
          },
        },
      };

      const output = options.format === 'json'
        ? JSON.stringify(schema, null, 2)
        : yaml.stringify(schema);

      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✓ Schema file created: ${options.output}`);
    });

  // Command: inspect
  program
    .command('inspect')
    .description('Inspect an AppSheet app and generate schema')
    .requiredOption('--app-id <id>', 'AppSheet App ID')
    .requiredOption('--access-key <key>', 'AppSheet Access Key')
    .requiredOption('--tables <tables>', 'Comma-separated list of table names')
    .option('--connection-name <name>', 'Connection name', 'default')
    .option('-o, --output <path>', 'Output file path', 'config/appsheet-schema.yaml')
    .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
    .action(async (options) => {
      try {
        const client = new AppSheetClient({
          appId: options.appId,
          applicationAccessKey: options.accessKey,
        });

        const inspector = new SchemaInspector(client);
        const tableNames = options.tables.split(',').map((t: string) => t.trim());

        console.log(`Inspecting ${tableNames.length} tables...`);
        const connection = await inspector.generateSchema(
          options.connectionName,
          tableNames
        );

        const schema: SchemaConfig = {
          connections: {
            [options.connectionName]: connection,
          },
        };

        const output = options.format === 'json'
          ? JSON.stringify(schema, null, 2)
          : yaml.stringify(schema);

        fs.writeFileSync(options.output, output, 'utf-8');
        console.log(`✓ Schema generated: ${options.output}`);
        console.log('\nPlease review and update:');
        console.log('  - Key fields may need manual adjustment');
        console.log('  - Field types are inferred and may need refinement');
        console.log('  - Add required, enum, and description properties as needed');
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: add-connection
  program
    .command('add-connection <name>')
    .description('Add a new connection to existing schema')
    .requiredOption('--app-id <id>', 'AppSheet App ID')
    .requiredOption('--access-key <key>', 'AppSheet Access Key')
    .requiredOption('--tables <tables>', 'Comma-separated list of table names')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action(async (name, options) => {
      try {
        // Load existing schema
        const existingContent = fs.readFileSync(options.schema, 'utf-8');
        const schema: SchemaConfig = yaml.parse(existingContent);

        // Generate new connection
        const client = new AppSheetClient({
          appId: options.appId,
          applicationAccessKey: options.accessKey,
        });

        const inspector = new SchemaInspector(client);
        const tableNames = options.tables.split(',').map((t: string) => t.trim());

        console.log(`Inspecting ${tableNames.length} tables for connection "${name}"...`);
        const connection = await inspector.generateSchema(name, tableNames);

        // Add to schema
        schema.connections[name] = connection;

        // Write back
        const output = yaml.stringify(schema);
        fs.writeFileSync(options.schema, output, 'utf-8');
        console.log(`✓ Connection "${name}" added to ${options.schema}`);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: add-table
  program
    .command('add-table <connection> <tableName>')
    .description('Add a table to an existing connection')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action(async (connection, tableName, options) => {
      try {
        // Load existing schema
        const existingContent = fs.readFileSync(options.schema, 'utf-8');
        const schema: SchemaConfig = yaml.parse(existingContent);

        if (!schema.connections[connection]) {
          throw new Error(`Connection "${connection}" not found in schema`);
        }

        // Create client from existing connection config
        const connDef = schema.connections[connection];
        const client = new AppSheetClient({
          appId: connDef.appId,
          applicationAccessKey: connDef.applicationAccessKey,
        });

        const inspector = new SchemaInspector(client);

        console.log(`Inspecting table "${tableName}"...`);
        const inspection = await inspector.inspectTable(tableName);

        // Add to schema
        const schemaName = inspector['toSchemaName'](tableName);
        schema.connections[connection].tables[schemaName] = {
          tableName: inspection.tableName,
          keyField: inspection.keyField,
          fields: inspection.fields,
        };

        // Write back
        const output = yaml.stringify(schema);
        fs.writeFileSync(options.schema, output, 'utf-8');
        console.log(`✓ Table "${tableName}" added to connection "${connection}"`);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: update-table
  program
    .command('update-table <connection> <schemaName>')
    .description('Update table definition by re-inspecting')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action(async (connection, schemaName, options) => {
      try {
        // Load existing schema
        const existingContent = fs.readFileSync(options.schema, 'utf-8');
        const schema: SchemaConfig = yaml.parse(existingContent);

        if (!schema.connections[connection]) {
          throw new Error(`Connection "${connection}" not found`);
        }

        const tableDef = schema.connections[connection].tables[schemaName];
        if (!tableDef) {
          throw new Error(`Table "${schemaName}" not found in connection "${connection}"`);
        }

        // Create client
        const connDef = schema.connections[connection];
        const client = new AppSheetClient({
          appId: connDef.appId,
          applicationAccessKey: connDef.applicationAccessKey,
        });

        const inspector = new SchemaInspector(client);

        console.log(`Re-inspecting table "${tableDef.tableName}"...`);
        const inspection = await inspector.inspectTable(tableDef.tableName);

        // Preserve keyField if it was manually set
        const updatedTable = {
          ...tableDef,
          fields: inspection.fields,
        };

        schema.connections[connection].tables[schemaName] = updatedTable;

        // Write back
        const output = yaml.stringify(schema);
        fs.writeFileSync(options.schema, output, 'utf-8');
        console.log(`✓ Table "${schemaName}" updated`);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: validate
  program
    .command('validate')
    .description('Validate schema file')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action((options) => {
      try {
        const content = fs.readFileSync(options.schema, 'utf-8');
        const schema = yaml.parse(content);
        const validation = SchemaLoader.validate(schema);

        if (validation.valid) {
          console.log('✓ Schema is valid');
        } else {
          console.error('✗ Schema validation failed:');
          validation.errors.forEach((err) => console.error(`  - ${err}`));
          process.exit(1);
        }
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  return program;
}
```

##### Verwendung des CLI Tools

```bash
# 1. Initialisiere leeres Schema
npx @yourorg/appsheet init

# 2. Generiere Schema durch Introspection
npx @yourorg/appsheet inspect \
  --app-id "your-app-id" \
  --access-key "your-access-key" \
  --tables "worklog,extract_issue,extract_account" \
  --connection-name worklog

# 3. Füge weitere Connection hinzu
npx @yourorg/appsheet add-connection hr \
  --app-id "hr-app-id" \
  --access-key "hr-access-key" \
  --tables "employees,departments"

# 4. Füge einzelne Tabelle hinzu
npx @yourorg/appsheet add-table worklog extract_budget

# 5. Aktualisiere Tabelle (z.B. nach Schema-Änderungen in AppSheet)
npx @yourorg/appsheet update-table worklog worklogs

# 6. Validiere Schema
npx @yourorg/appsheet validate

# 7. Output als JSON statt YAML
npx @yourorg/appsheet inspect \
  --app-id "your-app-id" \
  --access-key "your-access-key" \
  --tables "worklog" \
  --format json \
  --output config/appsheet-schema.json
```

##### Interactive Mode (Optional)

```typescript
// src/cli/interactive.ts
import * as inquirer from 'inquirer';

export async function interactiveSchemaBuilder() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'connectionName',
      message: 'Connection name:',
      default: 'default',
    },
    {
      type: 'input',
      name: 'appId',
      message: 'AppSheet App ID:',
    },
    {
      type: 'password',
      name: 'accessKey',
      message: 'Access Key:',
    },
    {
      type: 'input',
      name: 'tables',
      message: 'Table names (comma-separated):',
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: ['yaml', 'json'],
      default: 'yaml',
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output file path:',
      default: 'config/appsheet-schema.yaml',
    },
  ]);

  // Generate schema...
  console.log('Generating schema...');
  // ...
}

// Command
program
  .command('interactive')
  .alias('i')
  .description('Interactive schema builder')
  .action(interactiveSchemaBuilder);
```

```bash
# Interactive mode
npx @yourorg/appsheet interactive
```

##### Package.json Bin Entry

```json
{
  "name": "@yourorg/appsheet",
  "bin": {
    "appsheet": "./dist/cli/index.js"
  }
}
```

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { createCLI } from './commands';

const program = createCLI();
program.parse(process.argv);
```

### Vorteile der CLI-basierten Schema-Generierung

1. ✅ **Automatische Generierung** - Keine manuelle Typisierung
2. ✅ **Type Inference** - Feldtypen werden aus Daten ermittelt
3. ✅ **Inkrementelle Updates** - Einzelne Tabellen hinzufügen/aktualisieren
4. ✅ **Multi-Connection** - Mehrere Apps verwalten
5. ✅ **Validation** - Schema-Validierung vor Verwendung
6. ✅ **CI/CD Integration** - Kann in Deployment-Pipeline integriert werden
7. ✅ **Interactive Mode** - Für einfache Bedienung

### Ansatz 2: Hybrid Approach (TypeScript + Runtime)

Kombination aus TypeScript-Types und Runtime-Loading für beste Type-Safety:

```typescript
// config/schema.ts
import { SchemaLoader } from '@yourorg/appsheet';

// TypeScript interfaces für Compile-Time Type-Safety
export interface Worklog {
  id: string;
  userId: string;
  date: string;
  hours: number;
  description: string;
}

export interface Issue {
  key: string;
  summary: string;
  status: string;
}

// Schema aus File laden
export const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');

// Type-safe table accessors
export function getWorklogTable() {
  return db.table<Worklog>('worklog', 'worklogs');
}

export function getIssueTable() {
  return db.table<Issue>('worklog', 'issues');
}

// Verwendung mit voller Type-Safety:
const worklogs = await getWorklogTable().findAll(); // Type: Worklog[]
```

### Ansatz 3: Static Table Registry (Ursprünglicher Ansatz)

In jedem Projekt wird eine zentrale Schema-Datei erstellt:

```typescript
// src/schema/tables.ts (im konkreten Projekt)
import { TableSchema, createTableRegistry } from '@yourorg/appsheet';

// 1. TypeScript Interfaces für Tabellen-Strukturen
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export interface Worklog {
  id: string;
  userId: string;
  date: string;
  hours: number;
  description: string;
  projectKey: string;
}

export interface Project {
  key: string;
  name: string;
  budget: number;
  status: 'active' | 'completed' | 'archived';
}

// 2. Schema-Registry mit Metadaten
export const tableSchemas = {
  users: {
    tableName: 'extract_user',           // Tatsächlicher AppSheet Tabellenname
    keyField: 'id',                       // Primary Key
    type: {} as User,                     // Type Inference Helper
  },
  worklogs: {
    tableName: 'worklog',
    keyField: 'id',
    type: {} as Worklog,
  },
  projects: {
    tableName: 'extract_project',
    keyField: 'key',
    type: {} as Project,
  },
} as const;

// 3. Type-Helper für automatische Typinferenz
export type Tables = typeof tableSchemas;
export type TableName = keyof Tables;
export type TableType<T extends TableName> = Tables[T]['type'];

// 4. Registry-Instanz erstellen
export const tables = createTableRegistry(tableSchemas);
```

**Verwendung im Projekt:**

```typescript
// src/services/userService.ts
import { AppSheetClient } from '@yourorg/appsheet';
import { tables, User } from './schema/tables';

const client = new AppSheetClient({
  appId: process.env.APPSHEET_APP_ID!,
  applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
});

// Typsichere Table-Clients
const usersTable = tables.users(client);

// Alle Operationen sind jetzt typsicher!
const users = await usersTable.findAll();           // Type: User[]
const user = await usersTable.findOne('[Email] = "test@example.com"'); // Type: User | null

await usersTable.add([{
  id: '123',
  name: 'John',
  email: 'john@example.com',
  role: 'user',              // ✓ Autocomplete + Validation
  createdAt: new Date(),
}]);

await usersTable.update([{
  id: '123',
  name: 'Jane',              // Partial updates möglich
}]);

await usersTable.delete([{ id: '123' }]);
```

### Ansatz 2: Schema Builder Pattern

```typescript
// src/schema/schemaBuilder.ts (in der Library)
export class SchemaBuilder {
  private schemas = new Map<string, TableDefinition>();

  define<T>(config: {
    name: string;
    tableName: string;
    keyField: string;
    fields?: FieldDefinition[];
    validate?: (row: T) => boolean | string;
  }) {
    this.schemas.set(config.name, config);
    return this;
  }

  build() {
    return new TableRegistry(this.schemas);
  }
}

// Verwendung im Projekt:
export const schema = new SchemaBuilder()
  .define<User>({
    name: 'users',
    tableName: 'extract_user',
    keyField: 'id',
    fields: [
      { name: 'email', required: true, type: 'string' },
      { name: 'role', required: true, type: 'enum', values: ['admin', 'user'] }
    ]
  })
  .define<Worklog>({
    name: 'worklogs',
    tableName: 'worklog',
    keyField: 'id',
  })
  .build();

// Verwendung
const usersTable = schema.table<User>('users', client);
```

### Ansatz 3: Config-Datei + Code Generation (Optional)

Für große Projekte mit vielen Tabellen kann ein Generator nützlich sein:

```yaml
# appsheet.config.yaml (im Projekt)
tables:
  users:
    tableName: extract_user
    keyField: id
    fields:
      - name: id
        type: string
        required: true
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: role
        type: enum
        values: [admin, user]
      - name: createdAt
        type: date

  worklogs:
    tableName: worklog
    keyField: id
    fields:
      - name: id
        type: string
      - name: userId
        type: string
      - name: date
        type: string
      - name: hours
        type: number
```

```bash
# CLI Tool in der Library
npx @yourorg/appsheet generate-types --config appsheet.config.yaml --output src/schema
```

Generiert automatisch:
- TypeScript Interfaces
- Table Registry
- Validation Functions

### Table Registry Implementation (in der Library)

```typescript
// src/utils/tableRegistry.ts
export interface TableDefinition<T = any> {
  tableName: string;
  keyField: keyof T;
  type: T;
}

export type TableDefinitions = Record<string, TableDefinition>;

export class TypedTable<T extends Record<string, any>> {
  constructor(
    private client: AppSheetClient,
    private definition: TableDefinition<T>
  ) {}

  async findAll(): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
    });
    return result.rows;
  }

  async findOne(selector: string): Promise<T | null> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows[0] || null;
  }

  async add(rows: T[]): Promise<T[]> {
    const result = await this.client.add<T>({
      tableName: this.definition.tableName,
      rows,
    });
    return result.rows;
  }

  async update(rows: Partial<T>[]): Promise<T[]> {
    const result = await this.client.update<T>({
      tableName: this.definition.tableName,
      rows: rows as T[],
    });
    return result.rows;
  }

  async delete(keys: Pick<T, TableDefinition<T>['keyField']>[]): Promise<boolean> {
    await this.client.delete({
      tableName: this.definition.tableName,
      rows: keys,
    });
    return true;
  }

  // Builder-Pattern für Queries
  query() {
    return new TypedQueryBuilder<T>(this.client, this.definition.tableName);
  }
}

export function createTableRegistry<T extends TableDefinitions>(schemas: T) {
  type Registry = {
    [K in keyof T]: (client: AppSheetClient) => TypedTable<T[K]['type']>;
  };

  const registry = {} as Registry;

  for (const [key, schema] of Object.entries(schemas)) {
    registry[key as keyof T] = (client: AppSheetClient) => {
      return new TypedTable(client, schema);
    };
  }

  return registry;
}
```

### Query Builder für typsichere Queries

```typescript
export class TypedQueryBuilder<T extends Record<string, any>> {
  private filters: string[] = [];

  constructor(
    private client: AppSheetClient,
    private tableName: string
  ) {}

  where(field: keyof T, operator: '=' | '!=' | '>' | '<' | 'CONTAINS', value: any) {
    this.filters.push(`[${String(field)}] ${operator} "${value}"`);
    return this;
  }

  whereIn(field: keyof T, values: any[]) {
    const conditions = values.map(v => `[${String(field)}] = "${v}"`).join(' OR ');
    this.filters.push(`(${conditions})`);
    return this;
  }

  async execute(): Promise<T[]> {
    const selector = this.filters.join(' AND ');
    const result = await this.client.find<T>({
      tableName: this.tableName,
      selector,
    });
    return result.rows;
  }
}

// Verwendung:
const activeUsers = await usersTable
  .query()
  .where('status', '=', 'active')
  .where('role', '=', 'admin')
  .execute();
```

### Beispiel: Komplettes Projekt-Setup

```typescript
// src/db/index.ts (im konkreten MCP-Server Projekt)
import { AppSheetClient } from '@yourorg/appsheet';
import { tableSchemas, tables } from './schema';

// Singleton Client
let clientInstance: AppSheetClient | null = null;

export function getClient() {
  if (!clientInstance) {
    clientInstance = new AppSheetClient({
      appId: process.env.APPSHEET_APP_ID!,
      applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
    });
  }
  return clientInstance;
}

// Export typsichere Table-Clients
export const db = {
  users: () => tables.users(getClient()),
  worklogs: () => tables.worklogs(getClient()),
  projects: () => tables.projects(getClient()),
};

// Verwendung überall im Projekt:
import { db } from './db';

const users = await db.users().findAll();
const worklog = await db.worklogs().add([{ /* ... */ }]);
```

### Vorteile dieses Ansatzes

1. ✅ **Zentrale Definition**: Alle Tabellen an einem Ort
2. ✅ **Typsicherheit**: Vollständige TypeScript-Unterstützung
3. ✅ **Autocomplete**: IDE-Support für Feldnamen
4. ✅ **Einfache Wartung**: Änderungen nur an einer Stelle
5. ✅ **Wiederverwendbar**: Gleiches Pattern für alle Projekte
6. ✅ **Validation**: Optional runtime-validation möglich
7. ✅ **Testbar**: Einfach zu mocken für Tests

## Multi-Instance Support (Mehrere AppSheet Apps)

Ein MCP-Server muss oft mehrere verschiedene AppSheet-Instanzen ansteuern (z.B. verschiedene Apps für verschiedene Kunden/Projekte).

### Ansatz 1: Connection Manager Pattern (Empfohlen)

```typescript
// src/utils/connectionManager.ts (in der Library)
export interface ConnectionConfig {
  name: string;                       // Eindeutiger Name (z.B. "worklog-app", "hr-app")
  appId: string;
  applicationAccessKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export class ConnectionManager {
  private connections = new Map<string, AppSheetClient>();

  /**
   * Registriert eine neue AppSheet Connection
   */
  register(config: ConnectionConfig): void {
    if (this.connections.has(config.name)) {
      throw new Error(`Connection "${config.name}" already registered`);
    }

    const client = new AppSheetClient({
      appId: config.appId,
      applicationAccessKey: config.applicationAccessKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
    });

    this.connections.set(config.name, client);
  }

  /**
   * Gibt einen registrierten Client zurück
   */
  get(name: string): AppSheetClient {
    const client = this.connections.get(name);
    if (!client) {
      throw new Error(`Connection "${name}" not found. Available: ${[...this.connections.keys()].join(', ')}`);
    }
    return client;
  }

  /**
   * Prüft ob eine Connection existiert
   */
  has(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Entfernt eine Connection
   */
  remove(name: string): boolean {
    return this.connections.delete(name);
  }

  /**
   * Gibt alle registrierten Connection-Namen zurück
   */
  list(): string[] {
    return [...this.connections.keys()];
  }

  /**
   * Entfernt alle Connections
   */
  clear(): void {
    this.connections.clear();
  }
}
```

### Verwendung im MCP-Server Projekt

```typescript
// src/db/connections.ts
import { ConnectionManager } from '@yourorg/appsheet';

// Singleton ConnectionManager
export const connectionManager = new ConnectionManager();

// Connections beim Start registrieren
export function initializeConnections() {
  // Worklog App
  connectionManager.register({
    name: 'worklog',
    appId: process.env.APPSHEET_WORKLOG_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_WORKLOG_ACCESS_KEY!,
  });

  // HR App
  connectionManager.register({
    name: 'hr',
    appId: process.env.APPSHEET_HR_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_HR_ACCESS_KEY!,
  });

  // Customer Portal App
  connectionManager.register({
    name: 'customer-portal',
    appId: process.env.APPSHEET_PORTAL_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_PORTAL_ACCESS_KEY!,
  });
}
```

### Schema Definition pro App

```typescript
// src/schema/worklog/tables.ts
import { createTableRegistry } from '@yourorg/appsheet';

export interface Worklog {
  id: string;
  date: string;
  hours: number;
  description: string;
}

export interface Issue {
  key: string;
  summary: string;
  status: string;
}

export const worklogSchemas = {
  worklogs: {
    tableName: 'worklog',
    keyField: 'id',
    type: {} as Worklog,
  },
  issues: {
    tableName: 'extract_issue',
    keyField: 'key',
    type: {} as Issue,
  },
} as const;

export const worklogTables = createTableRegistry(worklogSchemas);
```

```typescript
// src/schema/hr/tables.ts
export interface Employee {
  id: string;
  name: string;
  department: string;
  hireDate: Date;
}

export interface Department {
  id: string;
  name: string;
  manager: string;
}

export const hrSchemas = {
  employees: {
    tableName: 'employees',
    keyField: 'id',
    type: {} as Employee,
  },
  departments: {
    tableName: 'departments',
    keyField: 'id',
    type: {} as Department,
  },
} as const;

export const hrTables = createTableRegistry(hrSchemas);
```

### Zentrales DB Interface

```typescript
// src/db/index.ts
import { connectionManager, initializeConnections } from './connections';
import { worklogTables } from '../schema/worklog/tables';
import { hrTables } from '../schema/hr/tables';

// Initialize connections on first import
initializeConnections();

// Export typsichere DB interfaces pro App
export const db = {
  // Worklog App
  worklog: {
    worklogs: () => worklogTables.worklogs(connectionManager.get('worklog')),
    issues: () => worklogTables.issues(connectionManager.get('worklog')),
  },

  // HR App
  hr: {
    employees: () => hrTables.employees(connectionManager.get('hr')),
    departments: () => hrTables.departments(connectionManager.get('hr')),
  },
};

// Verwendung im MCP-Server:
import { db } from './db';

// Worklog App zugreifen
const worklogs = await db.worklog.worklogs().findAll();
const issues = await db.worklog.issues().findAll();

// HR App zugreifen
const employees = await db.hr.employees().findAll();
const departments = await db.hr.departments().findAll();
```

### Ansatz 2: Namespace Pattern mit Factory

```typescript
// src/db/appFactory.ts
import { AppSheetClient, createTableRegistry } from '@yourorg/appsheet';

export function createAppConnection<T extends Record<string, any>>(
  config: {
    appId: string;
    applicationAccessKey: string;
  },
  schemas: T
) {
  const client = new AppSheetClient(config);
  const tables = createTableRegistry(schemas);

  // Wandle Registry in Table-Clients um
  const tableClients = {} as {
    [K in keyof T]: ReturnType<typeof tables[K]>;
  };

  for (const key of Object.keys(schemas)) {
    tableClients[key as keyof T] = tables[key as keyof T](client);
  }

  return {
    client,
    tables: tableClients,
  };
}

// Verwendung:
const worklogApp = createAppConnection(
  {
    appId: process.env.APPSHEET_WORKLOG_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_WORKLOG_ACCESS_KEY!,
  },
  worklogSchemas
);

const hrApp = createAppConnection(
  {
    appId: process.env.APPSHEET_HR_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_HR_ACCESS_KEY!,
  },
  hrSchemas
);

// Verwendung:
const worklogs = await worklogApp.tables.worklogs.findAll();
const employees = await hrApp.tables.employees.findAll();
```

### Ansatz 3: Dynamische Connection Resolution

Für Fälle, wo die Connection zur Laufzeit bestimmt wird:

```typescript
// src/utils/dynamicTable.ts (in der Library)
export class DynamicTableClient<T extends Record<string, any>> {
  constructor(
    private connectionManager: ConnectionManager,
    private tableName: string
  ) {}

  /**
   * Führt Operation auf einer spezifischen Connection aus
   */
  async findAll(connectionName: string): Promise<T[]> {
    const client = this.connectionManager.get(connectionName);
    return await client.findAll<T>(this.tableName);
  }

  async findOne(connectionName: string, selector: string): Promise<T | null> {
    const client = this.connectionManager.get(connectionName);
    return await client.findOne<T>(this.tableName, selector);
  }

  // ... weitere Methoden
}

// Verwendung im MCP-Server mit dynamischer Connection-Auswahl
const worklogTable = new DynamicTableClient<Worklog>(connectionManager, 'worklog');

// Tool-Handler, der Connection-Name vom User bekommt
async function handleGetWorklogs(connectionName: string) {
  return await worklogTable.findAll(connectionName);
}
```

### Environment Variables Pattern

```bash
# .env
# Worklog App
APPSHEET_WORKLOG_APP_ID=worklog-app-123
APPSHEET_WORKLOG_ACCESS_KEY=key-worklog-xyz

# HR App
APPSHEET_HR_APP_ID=hr-app-456
APPSHEET_HR_ACCESS_KEY=key-hr-abc

# Customer Portal
APPSHEET_PORTAL_APP_ID=portal-app-789
APPSHEET_PORTAL_ACCESS_KEY=key-portal-def
```

```typescript
// src/config/appsheet.ts
export const appSheetConfig = {
  worklog: {
    appId: process.env.APPSHEET_WORKLOG_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_WORKLOG_ACCESS_KEY!,
  },
  hr: {
    appId: process.env.APPSHEET_HR_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_HR_ACCESS_KEY!,
  },
  portal: {
    appId: process.env.APPSHEET_PORTAL_APP_ID!,
    applicationAccessKey: process.env.APPSHEET_PORTAL_ACCESS_KEY!,
  },
} as const;

export type AppName = keyof typeof appSheetConfig;
```

### Best Practice: Organization Pattern

Für übersichtliche Projekt-Struktur bei mehreren Apps:

```
src/
├── db/
│   ├── index.ts                    # Haupt-Export
│   ├── connections.ts              # ConnectionManager Setup
│   └── apps/
│       ├── worklog.ts              # Worklog App Interface
│       ├── hr.ts                   # HR App Interface
│       └── portal.ts               # Portal App Interface
├── schema/
│   ├── worklog/
│   │   └── tables.ts
│   ├── hr/
│   │   └── tables.ts
│   └── portal/
│       └── tables.ts
└── config/
    └── appsheet.ts                 # Environment Config
```

```typescript
// src/db/apps/worklog.ts
import { connectionManager } from '../connections';
import { worklogTables } from '../../schema/worklog/tables';

export const worklogDb = {
  worklogs: () => worklogTables.worklogs(connectionManager.get('worklog')),
  issues: () => worklogTables.issues(connectionManager.get('worklog')),
  accounts: () => worklogTables.accounts(connectionManager.get('worklog')),
};

// src/db/apps/hr.ts
export const hrDb = {
  employees: () => hrTables.employees(connectionManager.get('hr')),
  departments: () => hrTables.departments(connectionManager.get('hr')),
};

// src/db/index.ts
export { worklogDb } from './apps/worklog';
export { hrDb } from './apps/hr';
export { portalDb } from './apps/portal';

// Verwendung im MCP-Server:
import { worklogDb, hrDb } from './db';

const worklogs = await worklogDb.worklogs().findAll();
const employees = await hrDb.employees().findAll();
```

### Testing mit Multiple Connections

```typescript
// __tests__/setup.ts
import { connectionManager } from '../src/db/connections';

export function setupTestConnections() {
  connectionManager.register({
    name: 'test-worklog',
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
  });
}

export function teardownTestConnections() {
  connectionManager.clear();
}

// __tests__/worklog.test.ts
import { setupTestConnections, teardownTestConnections } from './setup';
import { worklogDb } from '../src/db';

beforeAll(() => setupTestConnections());
afterAll(() => teardownTestConnections());

test('should fetch worklogs', async () => {
  const worklogs = await worklogDb.worklogs().findAll();
  expect(worklogs).toBeDefined();
});
```

### Connection Health Check (Optional)

```typescript
export class ConnectionManager {
  // ... existing methods

  /**
   * Testet eine Connection
   */
  async ping(name: string): Promise<boolean> {
    try {
      const client = this.get(name);
      // Simple test query
      await client.find({ tableName: '_system', selector: '1=0' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Testet alle Connections
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const name of this.list()) {
      results[name] = await this.ping(name);
    }
    return results;
  }
}

// Verwendung:
const health = await connectionManager.healthCheck();
console.log('Connection health:', health);
// { worklog: true, hr: true, portal: false }
```

### Vorteile des Multi-Instance Supports

1. ✅ **Mehrere Apps**: Ein MCP-Server kann mehrere AppSheet-Apps verwalten
2. ✅ **Isolierung**: Klare Trennung zwischen verschiedenen Apps
3. ✅ **Typsicherheit**: Jede App hat ihre eigenen Types
4. ✅ **Flexibel**: Dynamische oder statische Connection-Auswahl
5. ✅ **Testbar**: Einfaches Mocken von Connections
6. ✅ **Skalierbar**: Neue Apps können einfach hinzugefügt werden
7. ✅ **Übersichtlich**: Klare Projekt-Struktur

## Best Practices für Verwendung in MCP-Servern

1. **Single Client Instance**: Pro MCP-Server eine Client-Instanz
2. **Environment Variables**: API-Keys aus Umgebungsvariablen laden
3. **Table Registry**: Zentrale Schema-Definition in `src/schema/tables.ts`
4. **TypedTable Clients**: Für jede Tabelle einen typed client verwenden
5. **Error Handling**: Spezifische Fehler catchen und an MCP weitergeben
6. **Caching**: Bei Read-Heavy Workloads CachedClient verwenden
7. **Query Builder**: Für komplexe Queries den TypedQueryBuilder nutzen

## Nächste Schritte

1. ✅ Projekt-Setup
2. ✅ Konzept erstellen
3. ⏳ Typen implementieren
4. ⏳ AppSheetClient implementieren
5. ⏳ Helper-Utilities implementieren
6. ⏳ Tests schreiben
7. ⏳ Dokumentation vervollständigen
8. ⏳ Beispiel-MCP-Server erstellen
