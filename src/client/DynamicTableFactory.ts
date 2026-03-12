/**
 * DynamicTableFactory - Factory for creating DynamicTable instances
 *
 * Implements DynamicTableFactoryInterface to enable dependency injection
 * in SchemaManager and flexible table instantiation strategies.
 *
 * @module client
 * @category Client
 */

import {
  DynamicTableFactoryInterface,
  AppSheetClientFactoryInterface,
  SchemaConfig,
  UnknownFieldPolicyInterface,
} from '../types';
import { StripUnknownFieldPolicy } from '../utils/policies';
import { DynamicTable } from './DynamicTable';

/**
 * Factory for creating DynamicTable instances.
 *
 * This factory creates DynamicTable instances by:
 * 1. Looking up the connection definition from the schema
 * 2. Creating a client using the injected client factory
 * 3. Getting the table definition from the connection
 * 4. Creating a DynamicTable with the client and table definition
 *
 * @category Client
 *
 * @example
 * ```typescript
 * // Create factory with client factory and schema (default: StripUnknownFieldPolicy)
 * const clientFactory = new AppSheetClientFactory();
 * const tableFactory = new DynamicTableFactory(clientFactory, schema);
 *
 * // Create factory with custom unknown field policy
 * const strictFactory = new DynamicTableFactory(clientFactory, schema, new ErrorUnknownFieldPolicy());
 *
 * // Create table instances
 * const usersTable = tableFactory.create<User>('worklog', 'users', 'user@example.com');
 * const users = await usersTable.findAll();
 *
 * // For testing, use MockAppSheetClientFactory
 * const mockClientFactory = new MockAppSheetClientFactory(testData);
 * const testTableFactory = new DynamicTableFactory(mockClientFactory, schema);
 * const testTable = testTableFactory.create<User>('worklog', 'users', 'test@example.com');
 * ```
 */
export class DynamicTableFactory implements DynamicTableFactoryInterface {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;

  /**
   * Creates a new DynamicTableFactory.
   *
   * @param clientFactory - Factory to create AppSheetClient instances
   * @param schema - Schema configuration with connection definitions
   * @param unknownFieldPolicy - Optional policy for handling unknown fields in DynamicTable (default: StripUnknownFieldPolicy)
   */
  constructor(
    private readonly clientFactory: AppSheetClientFactoryInterface,
    private readonly schema: SchemaConfig,
    unknownFieldPolicy?: UnknownFieldPolicyInterface
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
  }

  /**
   * Create a DynamicTable instance for a specific connection and table.
   *
   * @template T - The TypeScript type for rows in this table
   * @param connectionName - Name of the connection in the schema
   * @param tableName - Schema name of the table (not the AppSheet table name)
   * @param runAsUserEmail - Email of the user to execute all operations as
   * @returns A new DynamicTable instance configured for the specified table
   * @throws {Error} If the connection or table doesn't exist in the schema
   *
   * @example
   * ```typescript
   * const table = tableFactory.create<Worklog>('worklog', 'worklogs', 'user@example.com');
   * const worklogs = await table.findAll();
   * ```
   */
  create<T extends Record<string, any> = Record<string, any>>(
    connectionName: string,
    tableName: string,
    runAsUserEmail: string
  ): DynamicTable<T> {
    // Get connection definition from schema
    const connectionDef = this.schema.connections[connectionName];
    if (!connectionDef) {
      const available = Object.keys(this.schema.connections).join(', ') || 'none';
      throw new Error(
        `Connection "${connectionName}" not found. Available connections: ${available}`
      );
    }

    // Create client using factory
    const client = this.clientFactory.create(connectionDef, runAsUserEmail);

    // Get table definition (will throw if not found)
    const tableDef = client.getTable(tableName);

    // Resolve locale cascade: table locale > connection locale > undefined
    const effectiveLocale = tableDef.locale ?? connectionDef.locale ?? undefined;
    const resolvedTableDef =
      effectiveLocale !== tableDef.locale ? { ...tableDef, locale: effectiveLocale } : tableDef;

    // Create and return DynamicTable with injected policy
    return new DynamicTable<T>(client, resolvedTableDef, this.unknownFieldPolicy);
  }
}
