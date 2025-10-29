/**
 * Schema Manager for managing connections and tables from schema
 * @module utils
 * @category Schema Management
 */

import { SchemaConfig, ValidationError } from '../types';
import { ConnectionManager } from './ConnectionManager';
import { SchemaLoader } from './SchemaLoader';
import { DynamicTable } from '../client/DynamicTable';

/**
 * Manages connections and tables based on schema configuration.
 *
 * Central management class that initializes connections and provides
 * type-safe table clients based on a loaded schema configuration.
 *
 * @category Schema Management
 *
 * @example
 * ```typescript
 * // Load schema
 * const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
 *
 * // Create manager
 * const db = new SchemaManager(schema);
 *
 * // Get table clients
 * const worklogsTable = db.table<Worklog>('worklog', 'worklogs');
 * const usersTable = db.table<User>('hr', 'users');
 *
 * // Use table clients
 * const worklogs = await worklogsTable.findAll();
 * await worklogsTable.add([{ ... }]);
 * ```
 */
export class SchemaManager {
  private schema: SchemaConfig;
  private connectionManager: ConnectionManager;
  private tableClients = new Map<string, Map<string, DynamicTable<any>>>();

  constructor(schema: SchemaConfig) {
    // Validate schema
    const validation = SchemaLoader.validate(schema);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid schema: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    this.schema = schema;
    this.connectionManager = new ConnectionManager();
    this.initialize();
  }

  /**
   * Initialize all connections and table clients
   */
  private initialize(): void {
    for (const [connName, connDef] of Object.entries(this.schema.connections)) {
      // Register connection
      this.connectionManager.register({
        name: connName,
        appId: connDef.appId,
        applicationAccessKey: connDef.applicationAccessKey,
        baseUrl: connDef.baseUrl,
        timeout: connDef.timeout,
      });

      // Create table clients for this connection
      const tables = new Map<string, DynamicTable<any>>();
      for (const [tableName, tableDef] of Object.entries(connDef.tables)) {
        const client = this.connectionManager.get(connName);
        tables.set(tableName, new DynamicTable(client, tableDef));
      }
      this.tableClients.set(connName, tables);
    }
  }

  /**
   * Get a type-safe table client.
   *
   * Returns a DynamicTable instance for the specified table in the given connection.
   * The table client provides CRUD operations with runtime validation based on the schema.
   *
   * @template T - Type interface for the table rows
   * @param connectionName - The name of the connection containing the table
   * @param tableName - The name of the table as defined in the schema
   * @returns A DynamicTable instance for performing operations on the table
   * @throws {Error} If the connection or table doesn't exist
   *
   * @example
   * ```typescript
   * interface Worklog {
   *   id: string;
   *   date: string;
   *   hours: number;
   *   description: string;
   * }
   *
   * const worklogsTable = db.table<Worklog>('worklog', 'worklogs');
   * const entries = await worklogsTable.findAll();
   * await worklogsTable.add([{ id: '1', date: '2025-10-29', hours: 8, description: 'Work' }]);
   * ```
   */
  table<T = Record<string, any>>(connectionName: string, tableName: string): DynamicTable<T> {
    const connection = this.tableClients.get(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    const table = connection.get(tableName);
    if (!table) {
      const available = [...connection.keys()].join(', ');
      throw new Error(
        `Table "${tableName}" not found in connection "${connectionName}". ` +
          `Available tables: ${available}`
      );
    }

    return table as DynamicTable<T>;
  }

  /**
   * Get all available connection names.
   *
   * Returns an array of all connection names defined in the schema.
   * Useful for iterating over all connections or building dynamic UIs.
   *
   * @returns Array of connection names
   *
   * @example
   * ```typescript
   * const connections = db.getConnections();
   * console.log('Available connections:', connections);
   * // Output: ['worklog', 'hr', 'inventory']
   * ```
   */
  getConnections(): string[] {
    return [...this.tableClients.keys()];
  }

  /**
   * Get all available tables for a connection.
   *
   * Returns an array of table names that are defined for the specified connection.
   * Useful for discovering available tables at runtime.
   *
   * @param connectionName - The name of the connection
   * @returns Array of table names for the specified connection
   * @throws {Error} If the connection doesn't exist
   *
   * @example
   * ```typescript
   * const tables = db.getTables('worklog');
   * console.log('Available tables in worklog:', tables);
   * // Output: ['worklogs', 'issues', 'accounts']
   * ```
   */
  getTables(connectionName: string): string[] {
    const connection = this.tableClients.get(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }
    return [...connection.keys()];
  }

  /**
   * Get the underlying connection manager.
   *
   * Provides access to the internal ConnectionManager instance for advanced use cases,
   * such as direct client access or connection management.
   *
   * @returns The ConnectionManager instance
   *
   * @example
   * ```typescript
   * const connManager = db.getConnectionManager();
   * const health = await connManager.healthCheck();
   * console.log('Connection health:', health);
   * ```
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Reload schema configuration.
   *
   * Clears all existing connections and table clients, then reinitializes
   * them with the new schema. Useful for hot-reloading configuration changes.
   *
   * @param schema - The new schema configuration to load
   *
   * @example
   * ```typescript
   * // Load updated schema
   * const newSchema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
   * db.reload(newSchema);
   *
   * // All table clients now use the new configuration
   * const table = db.table('worklog', 'worklogs');
   * ```
   */
  reload(schema: SchemaConfig): void {
    this.tableClients.clear();
    this.connectionManager.clear();
    this.schema = schema;
    this.initialize();
  }

  /**
   * Get the current schema configuration.
   *
   * Returns the schema configuration that was loaded during initialization.
   * This is a reference to the internal schema object.
   *
   * @returns The current SchemaConfig
   *
   * @example
   * ```typescript
   * const schema = db.getSchema();
   * console.log('Loaded connections:', Object.keys(schema.connections));
   * ```
   */
  getSchema(): SchemaConfig {
    return this.schema;
  }
}
