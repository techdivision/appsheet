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
   * Initialize all connections from schema.
   *
   * Registers all connections defined in the schema with the ConnectionManager.
   * Table clients are created on-the-fly when requested via table() method.
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
        runAsUserEmail: connDef.runAsUserEmail,
      });
    }
  }

  /**
   * Get a type-safe table client, optionally for a specific user.
   *
   * Returns a DynamicTable instance for the specified table in the given connection.
   * The table client provides CRUD operations with runtime validation based on the schema.
   *
   * When runAsUserEmail is provided, creates a user-specific client that will execute
   * all operations as that user. The client is created on-the-fly and not cached (lightweight operation).
   *
   * When runAsUserEmail is not provided, uses the default client from the connection
   * (which may have a default runAsUserEmail configured in the schema).
   *
   * @template T - Type interface for the table rows
   * @param connectionName - The name of the connection containing the table
   * @param tableName - The name of the table as defined in the schema
   * @param runAsUserEmail - Optional: Email of the user to execute operations as
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
   * // Default behavior (existing code, backward compatible)
   * const worklogsTable = db.table<Worklog>('worklog', 'worklogs');
   * const entries = await worklogsTable.findAll();
   * await worklogsTable.add([{ id: '1', date: '2025-10-29', hours: 8, description: 'Work' }]);
   *
   * // User-specific behavior (new)
   * const userWorklogsTable = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');
   * const userEntries = await userWorklogsTable.findAll();
   * ```
   */
  table<T = Record<string, any>>(connectionName: string, tableName: string, runAsUserEmail?: string): DynamicTable<T> {
    // Check if connection exists in schema
    const connDef = this.schema.connections[connectionName];
    if (!connDef) {
      const available = Object.keys(this.schema.connections).join(', ') || 'none';
      throw new Error(
        `Connection "${connectionName}" not found. Available connections: ${available}`
      );
    }

    // Check if table exists in connection
    const tableDef = connDef.tables[tableName];
    if (!tableDef) {
      const available = Object.keys(connDef.tables).join(', ');
      throw new Error(
        `Table "${tableName}" not found in connection "${connectionName}". ` +
          `Available tables: ${available}`
      );
    }

    // Get client (with optional user context)
    const client = this.connectionManager.get(connectionName, runAsUserEmail);

    // Create and return table client on-the-fly
    return new DynamicTable<T>(client, tableDef);
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
    return Object.keys(this.schema.connections);
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
    const connDef = this.schema.connections[connectionName];
    if (!connDef) {
      const available = Object.keys(this.schema.connections).join(', ') || 'none';
      throw new Error(
        `Connection "${connectionName}" not found. Available connections: ${available}`
      );
    }
    return Object.keys(connDef.tables);
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
   * Clears all existing connections, then reinitializes them with the new schema.
   * Useful for hot-reloading configuration changes. Table clients are created
   * on-the-fly when requested via table() method.
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
