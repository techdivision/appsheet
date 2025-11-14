/**
 * Client interface types
 * @module types
 * @category Types
 */

import { AppSheetConfig } from './config';
import {
  AddOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
} from './operations';
import {
  AddResponse,
  FindResponse,
  UpdateResponse,
  DeleteResponse,
} from './responses';

/**
 * Interface for AppSheet client implementations.
 *
 * This interface defines the contract that all AppSheet client implementations
 * (real and mock) must follow. This ensures type safety and allows for easy
 * swapping between real and mock implementations in tests.
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Function that works with any client implementation
 * async function getUserCount(client: AppSheetClientInterface): Promise<number> {
 *   const users = await client.findAll('Users');
 *   return users.length;
 * }
 *
 * // Can use with real client
 * const realClient = new AppSheetClient({ appId, applicationAccessKey });
 * const count1 = await getUserCount(realClient);
 *
 * // Or with mock client
 * const mockClient = new MockAppSheetClient({ appId, applicationAccessKey });
 * const count2 = await getUserCount(mockClient);
 * ```
 */
export interface AppSheetClientInterface {
  /**
   * Add (Create) one or more rows to a table.
   *
   * @template T - The type of the rows being added
   * @param options - Options for the add operation
   * @returns Promise resolving to the created rows with server-generated fields
   */
  add<T extends Record<string, any> = Record<string, any>>(options: AddOptions<T>): Promise<AddResponse<T>>;

  /**
   * Find (Read) rows from a table with optional filtering.
   *
   * @template T - The type of the rows being retrieved
   * @param options - Options for the find operation
   * @returns Promise resolving to the found rows
   */
  find<T extends Record<string, any> = Record<string, any>>(options: FindOptions): Promise<FindResponse<T>>;

  /**
   * Update (Edit) one or more rows in a table.
   *
   * @template T - The type of the rows being updated
   * @param options - Options for the update operation
   * @returns Promise resolving to the updated rows
   */
  update<T extends Record<string, any> = Record<string, any>>(options: UpdateOptions<T>): Promise<UpdateResponse<T>>;

  /**
   * Delete one or more rows from a table.
   *
   * @template T - The type of the rows being deleted
   * @param options - Options for the delete operation
   * @returns Promise resolving to deletion result
   */
  delete<T extends Record<string, any> = Record<string, any>>(options: DeleteOptions<T>): Promise<DeleteResponse>;

  /**
   * Convenience method to find all rows in a table.
   *
   * @template T - The type of the rows being retrieved
   * @param tableName - The name of the table
   * @returns Promise resolving to all rows in the table
   */
  findAll<T extends Record<string, any> = Record<string, any>>(tableName: string): Promise<T[]>;

  /**
   * Convenience method to find a single row by selector.
   *
   * @template T - The type of the row being retrieved
   * @param tableName - The name of the table
   * @param selector - AppSheet selector expression to filter rows
   * @returns Promise resolving to the first matching row or null
   */
  findOne<T extends Record<string, any> = Record<string, any>>(tableName: string, selector: string): Promise<T | null>;

  /**
   * Convenience method to add a single row to a table.
   *
   * @template T - The type of the row being added
   * @param tableName - The name of the table
   * @param row - The row to add
   * @returns Promise resolving to the created row
   */
  addOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<T>;

  /**
   * Convenience method to update a single row in a table.
   *
   * @template T - The type of the row being updated
   * @param tableName - The name of the table
   * @param row - The row with updated fields (must include key field)
   * @returns Promise resolving to the updated row
   */
  updateOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<T>;

  /**
   * Convenience method to delete a single row from a table.
   *
   * @template T - The type of the row being deleted
   * @param tableName - The name of the table
   * @param row - The row to delete (must include key field)
   * @returns Promise resolving to true if deleted successfully
   */
  deleteOne<T extends Record<string, any> = Record<string, any>>(tableName: string, row: T): Promise<boolean>;

  /**
   * Get the current client configuration.
   *
   * @returns Readonly copy of the client configuration
   */
  getConfig(): Readonly<Required<Omit<AppSheetConfig, 'runAsUserEmail'>> & { runAsUserEmail?: string }>;
}
