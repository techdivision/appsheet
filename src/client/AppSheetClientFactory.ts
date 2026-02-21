/**
 * AppSheetClientFactory - Factory for creating real AppSheetClient instances
 *
 * Implements AppSheetClientFactoryInterface to enable dependency injection
 * in ConnectionManager and other components that need to create clients.
 *
 * @module client
 * @category Client
 */

import {
  AppSheetClientFactoryInterface,
  AppSheetClientInterface,
  ConnectionDefinition,
  SelectorBuilderInterface,
} from '../types';
import { AppSheetClient } from './AppSheetClient';
import { SelectorBuilder } from '../utils/SelectorBuilder';

/**
 * Factory for creating real AppSheetClient instances.
 *
 * This factory creates actual AppSheetClient instances that make real
 * HTTP requests to the AppSheet API. Use this factory in production.
 *
 * Accepts an optional {@link SelectorBuilderInterface} in the constructor
 * for DI/AOP extensibility. If not provided, the default {@link SelectorBuilder}
 * is used. The builder is passed to all created AppSheetClient instances.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * // Create factory with default SelectorBuilder
 * const factory = new AppSheetClientFactory();
 *
 * // Create factory with custom SelectorBuilder (e.g. for AOP logging)
 * const factory = new AppSheetClientFactory(new LoggedSelectorBuilder());
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
  private readonly selectorBuilder: SelectorBuilderInterface;

  /**
   * Creates a new AppSheetClientFactory.
   *
   * @param selectorBuilder - Optional custom SelectorBuilder for DI/AOP extensibility.
   *   If not provided, the default SelectorBuilder is used.
   */
  constructor(selectorBuilder?: SelectorBuilderInterface) {
    this.selectorBuilder = selectorBuilder ?? new SelectorBuilder();
  }

  /**
   * Create a new AppSheetClient instance.
   *
   * The factory's SelectorBuilder is passed to the created client instance.
   *
   * @param connectionDef - Full connection definition including app credentials and table schemas
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new AppSheetClient instance
   */
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new AppSheetClient(connectionDef, runAsUserEmail, this.selectorBuilder);
  }
}
