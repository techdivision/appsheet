/**
 * Factory interfaces for Dependency Injection support (v3.0.0)
 *
 * Provides factory interfaces that enable:
 * - Dependency injection in ConnectionManager and SchemaManager
 * - Easy testing with MockAppSheetClient
 * - Flexible client instantiation strategies
 *
 * @module types
 * @category Types
 */

import { AppSheetClientInterface } from './client';
import { ConnectionDefinition } from './schema';
import { DynamicTable } from '../client/DynamicTable';

/**
 * Factory interface for creating AppSheetClient instances.
 *
 * Implementations of this interface are responsible for instantiating
 * AppSheetClient (or compatible) instances. This enables:
 * - Dependency injection in ConnectionManager
 * - Testing with MockAppSheetClient via MockAppSheetClientFactory
 * - Custom client creation strategies
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Production usage with real client
 * const factory = new AppSheetClientFactory();
 * const client = factory.create(connectionDef, 'user@example.com');
 *
 * // Testing with mock client
 * const mockFactory = new MockAppSheetClientFactory();
 * const mockClient = mockFactory.create(connectionDef, 'user@example.com');
 * ```
 */
export interface AppSheetClientFactoryInterface {
  /**
   * Create a new AppSheetClient instance.
   *
   * @param connectionDef - Full connection definition including app credentials and table schemas
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new AppSheetClientInterface instance
   */
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface;
}

/**
 * Factory interface for creating DynamicTable instances.
 *
 * This factory abstracts the creation of DynamicTable instances,
 * enabling dependency injection in SchemaManager and flexible
 * table instantiation strategies.
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Factory creates tables using ConnectionManager
 * const tableFactory = new DynamicTableFactory(connectionManager);
 * const table = tableFactory.create<User>('worklog', 'users', 'user@example.com');
 *
 * // All operations execute as the specified user
 * const users = await table.findAll();
 * ```
 */
export interface DynamicTableFactoryInterface {
  /**
   * Create a DynamicTable instance for a specific connection and table.
   *
   * @template T - The TypeScript type for rows in this table
   * @param connectionName - Name of the connection in the schema
   * @param tableName - Schema name of the table (not the AppSheet table name)
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new DynamicTable instance configured for the specified table
   */
  create<T extends Record<string, any> = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T>;
}
