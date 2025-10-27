/**
 * CRUD operation types for AppSheet API
 */

import { RequestProperties } from './config';

/**
 * Options for Add (Create) operation
 */
export interface AddOptions<T = Record<string, any>> {
  /** Name of the table to add rows to */
  tableName: string;

  /** Array of rows to add */
  rows: T[];

  /** Optional request properties */
  properties?: RequestProperties;
}

/**
 * Options for Find (Read) operation
 */
export interface FindOptions {
  /** Name of the table to query */
  tableName: string;

  /** Optional selector/filter expression (e.g., "_RowNumber > 10") */
  selector?: string;

  /** Optional request properties */
  properties?: RequestProperties;
}

/**
 * Options for Update (Edit) operation
 */
export interface UpdateOptions<T = Record<string, any>> {
  /** Name of the table to update */
  tableName: string;

  /** Array of rows to update (must include key field) */
  rows: T[];

  /** Optional request properties */
  properties?: RequestProperties;
}

/**
 * Options for Delete operation
 */
export interface DeleteOptions<T = Record<string, any>> {
  /** Name of the table to delete from */
  tableName: string;

  /** Array of rows to delete (must include key field) */
  rows: T[];

  /** Optional request properties */
  properties?: RequestProperties;
}
