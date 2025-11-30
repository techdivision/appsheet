/**
 * AppSheetClientFactory - Factory for creating real AppSheetClient instances
 *
 * Implements AppSheetClientFactoryInterface to enable dependency injection
 * in ConnectionManager and other components that need to create clients.
 *
 * @module client
 * @category Client
 */

import { AppSheetClientFactoryInterface, AppSheetClientInterface, ConnectionDefinition } from '../types';
import { AppSheetClient } from './AppSheetClient';

/**
 * Factory for creating real AppSheetClient instances.
 *
 * This factory creates actual AppSheetClient instances that make real
 * HTTP requests to the AppSheet API. Use this factory in production.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * // Create factory
 * const factory = new AppSheetClientFactory();
 *
 * // Use factory to create clients
 * const connectionDef: ConnectionDefinition = {
 *   appId: 'your-app-id',
 *   applicationAccessKey: 'your-key',
 *   tables: { ... }
 * };
 *
 * const client = factory.create(connectionDef, 'user@example.com');
 * const users = await client.findAll('extract_user');
 *
 * // Inject factory into ConnectionManager
 * const connectionManager = new ConnectionManager(factory, schema);
 * ```
 */
export class AppSheetClientFactory implements AppSheetClientFactoryInterface {
  /**
   * Create a new AppSheetClient instance.
   *
   * @param connectionDef - Full connection definition including app credentials and table schemas
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new AppSheetClient instance
   */
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new AppSheetClient(connectionDef, runAsUserEmail);
  }
}
