/**
 * Connection Manager v3.0.0 - Simplified with Factory Injection
 *
 * The ConnectionManager creates AppSheetClient instances on-demand using
 * the injected factory and schema. Each call to get() creates a new client
 * configured for the specified user.
 *
 * @module utils
 * @category Connection Management
 */

import { AppSheetClientFactoryInterface, AppSheetClientInterface, SchemaConfig } from '../types';

/**
 * Manages AppSheet client instances using factory injection.
 *
 * In v3.0.0, ConnectionManager is simplified to focus solely on creating
 * user-specific client instances. The factory pattern enables:
 * - Easy testing by injecting MockAppSheetClientFactory
 * - On-demand client creation (no connection pooling)
 * - Per-request user context (runAsUserEmail is required)
 *
 * @category Connection Management
 *
 * @example
 * ```typescript
 * // Production setup
 * const clientFactory = new AppSheetClientFactory();
 * const schema = SchemaLoader.fromYaml('./config/schema.yaml');
 * const connectionManager = new ConnectionManager(clientFactory, schema);
 *
 * // Get client for specific user
 * const client = connectionManager.get('worklog', 'user@example.com');
 * const worklogs = await client.findAll('extract_worklog');
 *
 * // Testing setup with mock factory
 * const mockFactory = new MockAppSheetClientFactory(testData);
 * const testConnectionManager = new ConnectionManager(mockFactory, schema);
 * const testClient = testConnectionManager.get('worklog', 'test@example.com');
 * ```
 */
export class ConnectionManager {
  /**
   * Creates a new ConnectionManager.
   *
   * @param clientFactory - Factory to create AppSheetClient instances
   * @param schema - Schema configuration containing connection definitions
   *
   * @example
   * ```typescript
   * const factory = new AppSheetClientFactory();
   * const schema = SchemaLoader.fromYaml('./schema.yaml');
   * const manager = new ConnectionManager(factory, schema);
   * ```
   */
  constructor(
    private readonly clientFactory: AppSheetClientFactoryInterface,
    private readonly schema: SchemaConfig
  ) {}

  /**
   * Get a client for a specific connection and user.
   *
   * Creates a new AppSheetClient instance configured for the specified
   * connection and user. Each call creates a fresh client instance.
   *
   * @param connectionName - Name of the connection in the schema
   * @param runAsUserEmail - Email of the user to execute all operations as (required)
   * @returns A new AppSheetClientInterface instance
   * @throws {Error} If the connection doesn't exist in the schema
   *
   * @example
   * ```typescript
   * // Get client for user
   * const client = manager.get('worklog', 'user@example.com');
   *
   * // All operations execute as the specified user
   * const worklogs = await client.findAll('extract_worklog');
   * ```
   */
  get(connectionName: string, runAsUserEmail: string): AppSheetClientInterface {
    const connectionDef = this.schema.connections[connectionName];
    if (!connectionDef) {
      const available = Object.keys(this.schema.connections).join(', ') || 'none';
      throw new Error(
        `Connection "${connectionName}" not found. Available connections: ${available}`
      );
    }

    return this.clientFactory.create(connectionDef, runAsUserEmail);
  }

  /**
   * Get list of available connection names.
   *
   * Returns the names of all connections defined in the schema.
   * Useful for debugging and introspection.
   *
   * @returns Array of connection names
   *
   * @example
   * ```typescript
   * const names = manager.list();
   * console.log('Available connections:', names);
   * ```
   */
  list(): string[] {
    return Object.keys(this.schema.connections);
  }

  /**
   * Check if a connection exists in the schema.
   *
   * @param connectionName - The connection name to check
   * @returns `true` if the connection exists, `false` otherwise
   *
   * @example
   * ```typescript
   * if (manager.has('worklog')) {
   *   const client = manager.get('worklog', 'user@example.com');
   * }
   * ```
   */
  has(connectionName: string): boolean {
    return connectionName in this.schema.connections;
  }
}
