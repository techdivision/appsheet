/**
 * Connection Manager for handling multiple AppSheet connections
 * @module utils
 * @category Connection Management
 */

import { AppSheetClient } from '../client';
import { ConnectionConfig } from '../types';

/**
 * Manages multiple AppSheet client connections.
 *
 * Allows registering and retrieving multiple AppSheet app connections
 * by name, useful for projects that need to interact with multiple
 * AppSheet applications.
 *
 * @category Connection Management
 *
 * @example
 * ```typescript
 * const manager = new ConnectionManager();
 *
 * // Register connections
 * manager.register({
 *   name: 'worklog',
 *   appId: 'worklog-app-id',
 *   applicationAccessKey: 'key-1'
 * });
 *
 * manager.register({
 *   name: 'hr',
 *   appId: 'hr-app-id',
 *   applicationAccessKey: 'key-2'
 * });
 *
 * // Use connections
 * const worklogClient = manager.get('worklog');
 * const hrClient = manager.get('hr');
 * ```
 */
export class ConnectionManager {
  private connections = new Map<string, AppSheetClient>();

  /**
   * Register a new AppSheet connection.
   *
   * Adds a new connection to the manager that can be retrieved later by name.
   * Each connection must have a unique name within the manager.
   *
   * @param config - Connection configuration including name, appId, access key, and optional settings
   * @throws {Error} If a connection with the same name already exists
   *
   * @example
   * ```typescript
   * manager.register({
   *   name: 'worklog',
   *   appId: 'app-123',
   *   applicationAccessKey: 'key-xyz',
   *   runAsUserEmail: 'user@example.com',
   *   timeout: 60000
   * });
   * ```
   */
  register(config: ConnectionConfig): void {
    if (this.connections.has(config.name)) {
      throw new Error(`Connection "${config.name}" is already registered`);
    }

    const client = new AppSheetClient({
      appId: config.appId,
      applicationAccessKey: config.applicationAccessKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      runAsUserEmail: config.runAsUserEmail,
    });

    this.connections.set(config.name, client);
  }

  /**
   * Get a registered client by name, optionally for a specific user.
   *
   * When runAsUserEmail is provided, creates a new AppSheetClient instance
   * configured for that user. The user-specific client is created on-the-fly
   * and not cached (lightweight operation).
   *
   * When runAsUserEmail is not provided, returns the default registered client.
   *
   * @param name - The unique name of the connection to retrieve
   * @param runAsUserEmail - Optional: Email of the user to execute operations as
   * @returns The AppSheetClient instance for the specified connection
   * @throws {Error} If no connection with the given name exists
   *
   * @example
   * ```typescript
   * // Default behavior (existing code, backward compatible)
   * const client = manager.get('worklog');
   * const records = await client.findAll('worklogs');
   *
   * // User-specific behavior (new)
   * const userClient = manager.get('worklog', 'user@example.com');
   * const userRecords = await userClient.findAll('worklogs');
   * ```
   */
  get(name: string, runAsUserEmail?: string): AppSheetClient {
    const baseClient = this.connections.get(name);
    if (!baseClient) {
      const available = [...this.connections.keys()].join(', ') || 'none';
      throw new Error(
        `Connection "${name}" not found. Available connections: ${available}`
      );
    }

    // No user specified - return default client (backward compatible)
    if (!runAsUserEmail) {
      return baseClient;
    }

    // User specified - create user-specific client on-the-fly
    const config = baseClient.getConfig();
    return new AppSheetClient({
      appId: config.appId,
      applicationAccessKey: config.applicationAccessKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      runAsUserEmail, // Override with user-specific email
    });
  }

  /**
   * Check if a connection exists.
   *
   * Checks whether a connection with the given name has been registered.
   * This is useful to avoid errors when attempting to access connections.
   *
   * @param name - The connection name to check
   * @returns `true` if the connection exists, `false` otherwise
   *
   * @example
   * ```typescript
   * if (manager.has('worklog')) {
   *   const client = manager.get('worklog');
   * }
   * ```
   */
  has(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Remove a connection.
   *
   * Removes a registered connection from the manager.
   * The connection cannot be retrieved after removal.
   *
   * @param name - The name of the connection to remove
   * @returns `true` if the connection was removed, `false` if it didn't exist
   *
   * @example
   * ```typescript
   * manager.remove('old-connection');
   * ```
   */
  remove(name: string): boolean {
    return this.connections.delete(name);
  }

  /**
   * Get all registered connection names.
   *
   * Returns an array of all connection names currently registered
   * in the manager. Useful for iterating over all connections.
   *
   * @returns Array of connection names
   *
   * @example
   * ```typescript
   * const names = manager.list();
   * console.log('Available connections:', names);
   * // Output: ['worklog', 'hr', 'inventory']
   * ```
   */
  list(): string[] {
    return [...this.connections.keys()];
  }

  /**
   * Remove all connections.
   *
   * Clears all registered connections from the manager.
   * After calling this method, the manager will have no connections.
   *
   * @example
   * ```typescript
   * manager.clear();
   * console.log(manager.list()); // Output: []
   * ```
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Test a connection by performing a simple query.
   *
   * Attempts to execute a minimal query to verify that the connection
   * is working correctly. This is useful for health checks and diagnostics.
   *
   * @param name - The name of the connection to test
   * @returns Promise resolving to `true` if connection is healthy, `false` otherwise
   *
   * @example
   * ```typescript
   * const isHealthy = await manager.ping('worklog');
   * if (!isHealthy) {
   *   console.error('Worklog connection is down');
   * }
   * ```
   */
  async ping(name: string): Promise<boolean> {
    try {
      const client = this.get(name);
      // Attempt a minimal query
      await client.find({
        tableName: '_system',
        selector: '1=0',
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test all registered connections.
   *
   * Performs a health check on all registered connections concurrently.
   * Returns a record mapping connection names to their health status.
   *
   * @returns Promise resolving to an object with connection names as keys and health status as values
   *
   * @example
   * ```typescript
   * const health = await manager.healthCheck();
   * console.log(health);
   * // Output: { worklog: true, hr: true, inventory: false }
   *
   * // Check specific connection
   * if (!health.inventory) {
   *   console.error('Inventory connection failed');
   * }
   * ```
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const names = this.list();

    await Promise.all(
      names.map(async (name) => {
        results[name] = await this.ping(name);
      })
    );

    return results;
  }
}
