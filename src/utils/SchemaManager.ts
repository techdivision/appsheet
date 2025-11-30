/**
 * Schema Manager v3.0.0 - Factory-Based Table Creation
 *
 * The SchemaManager uses injected factories to create table clients on-demand.
 * This enables dependency injection and easy testing by swapping real factories
 * with mock implementations.
 *
 * @module utils
 * @category Schema Management
 */

import {
  SchemaConfig,
  ValidationError,
  AppSheetClientFactoryInterface,
  DynamicTableFactoryInterface,
} from '../types';
import { SchemaLoader } from './SchemaLoader';
import { DynamicTable, DynamicTableFactory } from '../client';

/**
 * Manages schema-based table access using factory injection.
 *
 * In v3.0.0, SchemaManager is simplified to focus on schema validation and
 * providing a clean API for accessing tables. Table clients are created
 * on-demand using the injected DynamicTableFactory.
 *
 * @category Schema Management
 *
 * @example
 * ```typescript
 * // Production setup
 * const clientFactory = new AppSheetClientFactory();
 * const schema = SchemaLoader.fromYaml('./config/schema.yaml');
 * const db = new SchemaManager(clientFactory, schema);
 *
 * // Get table client for specific user
 * const worklogsTable = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');
 * const entries = await worklogsTable.findAll();
 *
 * // Testing setup with mock factory
 * const mockFactory = new MockAppSheetClientFactory(testData);
 * const testDb = new SchemaManager(mockFactory, schema);
 * const testTable = testDb.table('worklog', 'worklogs', 'test@example.com');
 * ```
 */
export class SchemaManager {
  private readonly tableFactory: DynamicTableFactoryInterface;

  /**
   * Creates a new SchemaManager.
   *
   * @param clientFactory - Factory to create AppSheetClient instances
   * @param schema - Schema configuration containing connection and table definitions
   * @throws {ValidationError} If the schema is invalid
   *
   * @example
   * ```typescript
   * const factory = new AppSheetClientFactory();
   * const schema = SchemaLoader.fromYaml('./schema.yaml');
   * const db = new SchemaManager(factory, schema);
   * ```
   */
  constructor(
    clientFactory: AppSheetClientFactoryInterface,
    private readonly schema: SchemaConfig
  ) {
    // Validate schema
    const validation = SchemaLoader.validate(schema);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid schema: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    // Create table factory using injected client factory
    this.tableFactory = new DynamicTableFactory(clientFactory, schema);
  }

  /**
   * Get a type-safe table client for a specific user.
   *
   * Creates a DynamicTable instance for the specified table in the given connection.
   * The table client provides CRUD operations with runtime validation based on the schema.
   *
   * Each call creates a new client instance (lightweight operation).
   * The runAsUserEmail parameter is required in v3.0.0 to ensure explicit user context.
   *
   * @template T - Type interface for the table rows
   * @param connectionName - The name of the connection containing the table
   * @param tableName - The name of the table as defined in the schema
   * @param runAsUserEmail - Email of the user to execute all operations as (required)
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
   * // Get table client for specific user
   * const table = db.table<Worklog>('worklog', 'worklogs', 'user@example.com');
   * const entries = await table.findAll();
   * await table.add([{ id: '1', date: '2025-10-29', hours: 8, description: 'Work' }]);
   * ```
   */
  table<T extends Record<string, any> = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    return this.tableFactory.create<T>(connectionName, tableName, runAsUserEmail);
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
   * Check if a connection exists in the schema.
   *
   * @param connectionName - The connection name to check
   * @returns `true` if the connection exists, `false` otherwise
   *
   * @example
   * ```typescript
   * if (db.hasConnection('worklog')) {
   *   const table = db.table('worklog', 'worklogs', 'user@example.com');
   * }
   * ```
   */
  hasConnection(connectionName: string): boolean {
    return connectionName in this.schema.connections;
  }

  /**
   * Check if a table exists in a connection.
   *
   * @param connectionName - The connection name
   * @param tableName - The table name to check
   * @returns `true` if the table exists in the connection, `false` otherwise
   *
   * @example
   * ```typescript
   * if (db.hasTable('worklog', 'worklogs')) {
   *   const table = db.table('worklog', 'worklogs', 'user@example.com');
   * }
   * ```
   */
  hasTable(connectionName: string, tableName: string): boolean {
    const connDef = this.schema.connections[connectionName];
    return connDef ? tableName in connDef.tables : false;
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
