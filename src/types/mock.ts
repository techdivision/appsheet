/**
 * Type definitions for Mock implementations
 *
 * Provides interfaces for project-specific mock data providers.
 * Mock data should be implemented per project, not in the library.
 *
 * @module types
 * @category Types
 */

/**
 * Table data structure for mock database.
 *
 * Contains rows and optional key field specification.
 *
 * @typeParam T - Type of rows in the table
 *
 * @example
 * ```typescript
 * const tableData: TableData<User> = {
 *   rows: [
 *     { id: '1', name: 'John' },
 *     { id: '2', name: 'Jane' }
 *   ],
 *   keyField: 'id'
 * };
 * ```
 */
export interface TableData<T = any> {
  /**
   * Array of rows to be inserted into the table.
   * Each row should contain the key field specified in keyField.
   */
  rows: T[];

  /**
   * Name of the field to use as primary key.
   *
   * If not provided, the MockDatabase will auto-detect the key field
   * by looking for fields ending with '_id' (e.g., 'service_portfolio_id'),
   * or falling back to 'id'.
   *
   * @example 'service_portfolio_id'
   * @example 'user_id'
   * @example 'id'
   */
  keyField?: string;
}

/**
 * Interface for project-specific mock data providers.
 *
 * Implement this interface to provide custom mock data for your project.
 * The interface is intentionally generic - it does not prescribe specific
 * methods like getUsers() or getServices() since these are project-specific.
 *
 * @category Mock
 *
 * @example
 * ```typescript
 * // Example: Service Portfolio Mock Data
 * class ServicePortfolioMockData implements MockDataProvider {
 *   getTables(): Map<string, TableData> {
 *     const tables = new Map<string, TableData>();
 *
 *     tables.set('area', {
 *       rows: [
 *         { area_id: 'area-001', name: 'Consulting' },
 *         { area_id: 'area-002', name: 'Solutions' },
 *       ],
 *       keyField: 'area_id'
 *     });
 *
 *     tables.set('service_portfolio', {
 *       rows: [
 *         {
 *           service_portfolio_id: 'service-001',
 *           service: 'Cloud Migration',
 *           area_id_fk: 'area-001',
 *           status: 'Akzeptiert'
 *         },
 *         // ... more services
 *       ],
 *       keyField: 'service_portfolio_id'
 *     });
 *
 *     return tables;
 *   }
 * }
 *
 * // Usage with MockAppSheetClient
 * const mockData = new ServicePortfolioMockData();
 * const client = new MockAppSheetClient({
 *   appId: 'mock-app',
 *   applicationAccessKey: 'mock-key'
 * }, mockData);
 *
 * // Tables are automatically seeded
 * const services = await client.findAll('service_portfolio');
 * ```
 *
 * @example
 * ```typescript
 * // Example: E-Commerce Mock Data
 * class ECommerceMockData implements MockDataProvider {
 *   getTables(): Map<string, TableData> {
 *     const tables = new Map<string, TableData>();
 *
 *     tables.set('products', {
 *       rows: [
 *         { id: '1', name: 'Laptop', price: 999 },
 *         { id: '2', name: 'Mouse', price: 29 },
 *       ],
 *       keyField: 'id'
 *     });
 *
 *     tables.set('orders', {
 *       rows: [
 *         { id: '1', product_id: '1', quantity: 1 },
 *       ],
 *       keyField: 'id'
 *     });
 *
 *     return tables;
 *   }
 * }
 * ```
 */
export interface MockDataProvider {
  /**
   * Get all tables with their mock data.
   *
   * Returns a Map where:
   * - Key: Table name (e.g., 'service_portfolio', 'users', 'products')
   * - Value: TableData with rows and optional keyField
   *
   * This method is called by MockAppSheetClient to seed the mock database.
   *
   * @returns Map of table name to table data
   */
  getTables(): Map<string, TableData>;
}
