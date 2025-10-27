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
   * Register a new AppSheet connection
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
    });

    this.connections.set(config.name, client);
  }

  /**
   * Get a registered client by name
   */
  get(name: string): AppSheetClient {
    const client = this.connections.get(name);
    if (!client) {
      const available = [...this.connections.keys()].join(', ') || 'none';
      throw new Error(
        `Connection "${name}" not found. Available connections: ${available}`
      );
    }
    return client;
  }

  /**
   * Check if a connection exists
   */
  has(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Remove a connection
   */
  remove(name: string): boolean {
    return this.connections.delete(name);
  }

  /**
   * Get all registered connection names
   */
  list(): string[] {
    return [...this.connections.keys()];
  }

  /**
   * Remove all connections
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Test a connection by performing a simple query
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
   * Test all registered connections
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
