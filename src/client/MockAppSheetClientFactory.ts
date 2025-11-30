/**
 * MockAppSheetClientFactory - Factory for creating MockAppSheetClient instances
 *
 * Implements AppSheetClientFactoryInterface to enable easy testing
 * by substituting real clients with mock implementations.
 *
 * @module client
 * @category Client
 */

import {
  AppSheetClientFactoryInterface,
  AppSheetClientInterface,
  ConnectionDefinition,
  MockDataProvider,
} from '../types';
import { MockAppSheetClient } from './MockAppSheetClient';

/**
 * Factory for creating MockAppSheetClient instances.
 *
 * This factory creates mock client instances that use in-memory storage
 * instead of making real API calls. Use this factory for testing.
 *
 * Can be configured with an optional MockDataProvider to automatically
 * seed all created clients with test data.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * // Basic usage - empty mock database
 * const factory = new MockAppSheetClientFactory();
 * const client = factory.create(connectionDef, 'user@example.com');
 *
 * // With data provider - auto-seeds all clients
 * const mockData = new MyProjectMockData();
 * const factory = new MockAppSheetClientFactory(mockData);
 * const client = factory.create(connectionDef, 'user@example.com');
 * // client already has test data from mockData
 *
 * // Use in tests with ConnectionManager
 * const mockFactory = new MockAppSheetClientFactory(testData);
 * const connectionManager = new ConnectionManager(mockFactory, schema);
 * ```
 */
export class MockAppSheetClientFactory implements AppSheetClientFactoryInterface {
  /**
   * Creates a new MockAppSheetClientFactory.
   *
   * @param dataProvider - Optional data provider to automatically seed all created clients
   */
  constructor(private readonly dataProvider?: MockDataProvider) {}

  /**
   * Create a new MockAppSheetClient instance.
   *
   * If a dataProvider was supplied to the factory constructor, the created
   * client will be automatically seeded with the provider's test data.
   *
   * @param connectionDef - Full connection definition including app credentials and table schemas
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new MockAppSheetClient instance
   */
  create(connectionDef: ConnectionDefinition, runAsUserEmail: string): AppSheetClientInterface {
    return new MockAppSheetClient(connectionDef, runAsUserEmail, this.dataProvider);
  }
}
