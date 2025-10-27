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
   * Get a table client
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
   * Get all available connection names
   */
  getConnections(): string[] {
    return [...this.tableClients.keys()];
  }

  /**
   * Get all available tables for a connection
   */
  getTables(connectionName: string): string[] {
    const connection = this.tableClients.get(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }
    return [...connection.keys()];
  }

  /**
   * Get the underlying connection manager
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Reload schema (useful for hot-reloading)
   */
  reload(schema: SchemaConfig): void {
    this.tableClients.clear();
    this.connectionManager.clear();
    this.schema = schema;
    this.initialize();
  }

  /**
   * Get the current schema
   */
  getSchema(): SchemaConfig {
    return this.schema;
  }
}
