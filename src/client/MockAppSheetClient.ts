/**
 * MockAppSheetClient - Mock Implementation for Testing
 *
 * Provides a mock implementation of AppSheetClient for testing purposes.
 * Uses in-memory storage instead of making real API requests.
 *
 * @module client
 * @category Client
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AppSheetClientInterface,
  ConnectionDefinition,
  TableDefinition,
  AddOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  AddResponse,
  FindResponse,
  UpdateResponse,
  DeleteResponse,
  ValidationError,
  NotFoundError,
  MockDataProvider,
} from '../types';
import { MockDatabase } from './__mocks__/MockDatabase';
import { createDefaultMockData } from './__mocks__/mockData';

/**
 * Mock AppSheet API client for testing.
 *
 * Implements the same interface as AppSheetClient but uses an in-memory database.
 * Useful for unit and integration tests without hitting the real AppSheet API.
 *
 * In v3.0.0, accepts a ConnectionDefinition (including table schemas) and runAsUserEmail.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * const connectionDef: ConnectionDefinition = {
 *   appId: 'mock-app',
 *   applicationAccessKey: 'mock-key',
 *   tables: {
 *     users: {
 *       tableName: 'extract_user',
 *       keyField: 'id',
 *       fields: { id: { type: 'Text', required: true } }
 *     }
 *   }
 * };
 *
 * // Create mock client
 * const client = new MockAppSheetClient(connectionDef, 'user@example.com');
 * client.seedDatabase(); // Load default example data
 *
 * // Use like real client
 * const users = await client.findAll('extract_user');
 * const user = await client.addOne('extract_user', { id: '2', name: 'Jane' });
 *
 * // Get table definition
 * const tableDef = client.getTable('users');
 * ```
 */
export class MockAppSheetClient implements AppSheetClientInterface {
  private readonly connectionDef: ConnectionDefinition;
  private readonly runAsUserEmail: string;
  private readonly database: MockDatabase;

  /**
   * Creates a new Mock AppSheet client instance.
   *
   * @param connectionDef - Full connection definition including app credentials and table schemas
   * @param runAsUserEmail - Email of the user to execute all operations as (required)
   * @param dataProvider - Optional project-specific mock data provider. If provided, tables are automatically seeded.
   *
   * @example
   * ```typescript
   * const connectionDef: ConnectionDefinition = {
   *   appId: 'mock-app',
   *   applicationAccessKey: 'mock-key',
   *   tables: { ... }
   * };
   *
   * // Without data provider (manual seeding)
   * const client = new MockAppSheetClient(connectionDef, 'test@example.com');
   * client.seedDatabase(); // Load default example data
   *
   * // With data provider (automatic seeding)
   * const mockData = new MyProjectMockData();
   * const client = new MockAppSheetClient(connectionDef, 'test@example.com', mockData);
   * ```
   */
  constructor(connectionDef: ConnectionDefinition, runAsUserEmail: string, dataProvider?: MockDataProvider) {
    this.connectionDef = connectionDef;
    this.runAsUserEmail = runAsUserEmail;
    this.database = new MockDatabase();

    // Auto-seed from data provider if provided
    if (dataProvider) {
      this.loadFromProvider(dataProvider);
    }
  }

  /**
   * Seed the database with default example mock data.
   *
   * **Note:** This method loads generic example data for quick testing.
   * For production tests, use a project-specific MockDataProvider instead.
   *
   * Creates:
   * - 3 areas (generic examples)
   * - 4 categories (generic examples)
   * - 50 services (generic examples with UUIDs)
   *
   * @deprecated Consider using MockDataProvider for project-specific test data
   *
   * @example
   * ```typescript
   * // Quick testing with example data
   * client.seedDatabase();
   * const services = await client.findAll('service_portfolio');
   * // Returns 50 generic example services
   * ```
   */
  seedDatabase(): void {
    const { areas, categories, services } = createDefaultMockData();

    this.database.initializeTable('area', areas, 'area_id');
    this.database.initializeTable('category', categories, 'category_id');
    this.database.initializeTable('service_portfolio', services, 'service_portfolio_id');
  }

  /**
   * Clear all data from the mock database.
   *
   * Useful for cleaning up between tests.
   */
  clearDatabase(): void {
    this.database.clearAll();
  }

  /**
   * Clear a specific table.
   *
   * @param tableName - Name of the table to clear
   */
  clearTable(tableName: string): void {
    this.database.clearTable(tableName);
  }

  /**
   * Add (Create) one or more rows to a table.
   */
  async add<T extends Record<string, any> = Record<string, any>>(options: AddOptions<T>): Promise<AddResponse<T>> {
    const createdRows: T[] = [];

    for (const row of options.rows) {
      // Generate ID if not provided
      const keyField = this.getKeyField(options.tableName);
      const rowWithId = {
        ...row,
        [keyField]: (row as any)[keyField] || uuidv4(),
        created_at: new Date().toISOString(),
        created_by:
          options.properties?.RunAsUserEmail || this.runAsUserEmail,
      } as T;

      const created = this.database.insert(options.tableName, rowWithId, keyField);
      createdRows.push(created);
    }

    return {
      rows: createdRows,
      warnings: [],
    };
  }

  /**
   * Find (Read) rows from a table with optional filtering.
   */
  async find<T extends Record<string, any> = Record<string, any>>(options: FindOptions): Promise<FindResponse<T>> {
    let rows = this.database.findAll<T>(options.tableName);

    // Apply selector filter if provided
    if (options.selector) {
      rows = this.applySelector(rows, options.selector);
    }

    return {
      rows,
      warnings: [],
    };
  }

  /**
   * Update (Edit) one or more rows in a table.
   */
  async update<T extends Record<string, any> = Record<string, any>>(options: UpdateOptions<T>): Promise<UpdateResponse<T>> {
    const updatedRows: T[] = [];
    const keyField = this.getKeyField(options.tableName);

    for (const row of options.rows) {
      const keyValue = (row as any)[keyField];
      if (!keyValue) {
        throw new ValidationError(
          `Row is missing key field "${keyField}"`,
          { field: keyField, tableName: options.tableName }
        );
      }

      const updated = this.database.update<T>(options.tableName, keyValue, {
        ...row,
        modified_at: new Date().toISOString(),
        modified_by:
          options.properties?.RunAsUserEmail || this.runAsUserEmail,
      } as Partial<T>);

      if (!updated) {
        throw new NotFoundError(
          `Row with key "${keyValue}" not found in table "${options.tableName}"`,
          { key: keyValue, tableName: options.tableName }
        );
      }

      updatedRows.push(updated);
    }

    return {
      rows: updatedRows,
      warnings: [],
    };
  }

  /**
   * Delete one or more rows from a table.
   */
  async delete<T extends Record<string, any> = Record<string, any>>(options: DeleteOptions<T>): Promise<DeleteResponse> {
    const keyField = this.getKeyField(options.tableName);
    let deletedCount = 0;

    for (const row of options.rows) {
      const keyValue = (row as any)[keyField];
      if (!keyValue) {
        throw new ValidationError(
          `Row is missing key field "${keyField}"`,
          { field: keyField, tableName: options.tableName }
        );
      }

      const deleted = this.database.delete(options.tableName, keyValue);
      if (deleted) {
        deletedCount++;
      }
    }

    return {
      success: true,
      deletedCount,
      warnings: [],
    };
  }

  /**
   * Convenience method to find all rows in a table.
   */
  async findAll<T extends Record<string, any> = Record<string, any>>(tableName: string): Promise<T[]> {
    const response = await this.find<T>({ tableName });
    return response.rows;
  }

  /**
   * Convenience method to find a single row by selector.
   */
  async findOne<T extends Record<string, any> = Record<string, any>>(
    tableName: string,
    selector: string
  ): Promise<T | null> {
    const response = await this.find<T>({ tableName, selector });
    return response.rows[0] || null;
  }

  /**
   * Convenience method to add a single row to a table.
   */
  async addOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<T> {
    const response = await this.add<T>({ tableName, rows: [row] });
    return response.rows[0];
  }

  /**
   * Convenience method to update a single row in a table.
   */
  async updateOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<T> {
    const response = await this.update<T>({ tableName, rows: [row] });
    return response.rows[0];
  }

  /**
   * Convenience method to delete a single row from a table.
   */
  async deleteOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<boolean> {
    await this.delete<T>({ tableName, rows: [row] });
    return true;
  }

  /**
   * Get a table definition by name.
   *
   * Returns the TableDefinition for the specified table from the client's
   * ConnectionDefinition. Used by DynamicTableFactory to create DynamicTable instances.
   *
   * @param tableName - The schema name of the table (not the AppSheet table name)
   * @returns The TableDefinition for the specified table
   * @throws {Error} If the table doesn't exist in the connection
   */
  getTable(tableName: string): TableDefinition {
    const tableDef = this.connectionDef.tables[tableName];
    if (!tableDef) {
      const available = Object.keys(this.connectionDef.tables).join(', ') || 'none';
      throw new Error(`Table "${tableName}" not found. Available tables: ${available}`);
    }
    return tableDef;
  }

  /**
   * Load mock data from a MockDataProvider.
   *
   * Initializes all tables provided by the data provider.
   * Useful for seeding the database with project-specific test data.
   *
   * @param provider - MockDataProvider implementation with getTables()
   *
   * @example
   * ```typescript
   * const mockData = new MyProjectMockData();
   * client.loadFromProvider(mockData);
   * ```
   */
  private loadFromProvider(provider: MockDataProvider): void {
    const tables = provider.getTables();

    tables.forEach((tableData, tableName) => {
      this.database.initializeTable(tableName, tableData.rows, tableData.keyField);
    });
  }

  /**
   * Get the key field for a table.
   *
   * Maps table names to their primary key fields.
   */
  private getKeyField(tableName: string): string {
    const keyFieldMap: Record<string, string> = {
      service_portfolio: 'service_portfolio_id',
      area: 'area_id',
      category: 'category_id',
    };

    return keyFieldMap[tableName] || 'id';
  }

  /**
   * Apply AppSheet selector filter to rows.
   *
   * Supports simple selectors like:
   * - `[field] = "value"` - Exact match
   * - `[field] = 'value'` - Exact match (single quotes)
   * - `[field] IN ("value1", "value2")` - Array match
   *
   * @param rows - Rows to filter
   * @param selector - AppSheet selector expression
   * @returns Filtered rows
   */
  private applySelector<T>(rows: T[], selector: string): T[] {
    // Parse simple selector: [field] = "value"
    const exactMatchRegex = /\[(\w+)\]\s*=\s*["']([^"']+)["']/;
    const exactMatch = selector.match(exactMatchRegex);

    if (exactMatch) {
      const [, field, value] = exactMatch;
      return rows.filter((row) => (row as any)[field] === value);
    }

    // Parse IN selector: [field] IN ("value1", "value2")
    const inMatchRegex = /\[(\w+)\]\s+IN\s+\(([^)]+)\)/i;
    const inMatch = selector.match(inMatchRegex);

    if (inMatch) {
      const [, field, valuesStr] = inMatch;
      const values = valuesStr
        .split(',')
        .map((v) => v.trim().replace(/["']/g, ''));

      return rows.filter((row) => values.includes((row as any)[field]));
    }

    // If selector is not recognized, return all rows (no filter)
    return rows;
  }
}
