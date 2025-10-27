/**
 * Response types for AppSheet API operations
 */

/**
 * Response from Add operation
 */
export interface AddResponse<T = Record<string, any>> {
  /** Array of created rows (with server-generated fields) */
  rows: T[];

  /** Optional warnings from the API */
  warnings?: string[];
}

/**
 * Response from Find operation
 */
export interface FindResponse<T = Record<string, any>> {
  /** Array of found rows */
  rows: T[];

  /** Optional warnings from the API */
  warnings?: string[];
}

/**
 * Response from Update operation
 */
export interface UpdateResponse<T = Record<string, any>> {
  /** Array of updated rows */
  rows: T[];

  /** Optional warnings from the API */
  warnings?: string[];
}

/**
 * Response from Delete operation
 */
export interface DeleteResponse {
  /** Whether the operation was successful */
  success: boolean;

  /** Number of rows deleted */
  deletedCount: number;

  /** Optional warnings from the API */
  warnings?: string[];
}

/**
 * Generic API response structure
 */
export interface ApiResponse<T = any> {
  /** Response data */
  Rows?: T[];

  /** Warnings from API */
  Warnings?: string[];

  /** Error message if request failed */
  error?: string;
}
