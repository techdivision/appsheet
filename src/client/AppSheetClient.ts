/**
 * Main AppSheet API client module
 * @module client
 * @category Client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AppSheetConfig,
  AddOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  AddResponse,
  FindResponse,
  UpdateResponse,
  DeleteResponse,
  ApiResponse,
  AppSheetError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
} from '../types';

/**
 * AppSheet API client for performing CRUD operations on AppSheet tables.
 *
 * This is the main client class that provides methods for creating, reading,
 * updating, and deleting data from AppSheet tables via the AppSheet API v2.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * const client = new AppSheetClient({
 *   appId: 'your-app-id',
 *   applicationAccessKey: 'your-access-key'
 * });
 *
 * // Find all rows
 * const users = await client.findAll('Users');
 *
 * // Add a row
 * await client.addOne('Users', { name: 'John', email: 'john@example.com' });
 * ```
 */
export class AppSheetClient {
  private readonly axios: AxiosInstance;
  private readonly config: Required<AppSheetConfig>;

  /**
   * Creates a new AppSheet API client instance.
   *
   * @param config - Configuration for the AppSheet client
   * @throws {ValidationError} If required configuration fields are missing
   *
   * @example
   * ```typescript
   * const client = new AppSheetClient({
   *   appId: process.env.APPSHEET_APP_ID!,
   *   applicationAccessKey: process.env.APPSHEET_ACCESS_KEY!,
   *   timeout: 60000,  // Optional: 60 seconds
   *   retryAttempts: 5  // Optional: retry 5 times
   * });
   * ```
   */
  constructor(config: AppSheetConfig) {
    // Apply defaults
    this.config = {
      baseUrl: 'https://api.appsheet.com/api/v2',
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    // Create axios instance
    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ApplicationAccessKey: this.config.applicationAccessKey,
      },
    });
  }

  /**
   * Add (Create) one or more rows to a table.
   *
   * @template T - The type of the rows being added
   * @param options - Options for the add operation
   * @returns Promise resolving to the created rows with server-generated fields
   * @throws {AuthenticationError} If authentication fails
   * @throws {ValidationError} If the data is invalid
   * @throws {NetworkError} If the request fails due to network issues
   *
   * @example
   * ```typescript
   * const result = await client.add({
   *   tableName: 'Users',
   *   rows: [
   *     { name: 'John Doe', email: 'john@example.com' },
   *     { name: 'Jane Smith', email: 'jane@example.com' }
   *   ]
   * });
   * console.log('Created users:', result.rows);
   * ```
   */
  async add<T = Record<string, any>>(options: AddOptions<T>): Promise<AddResponse<T>> {
    const url = `/apps/${this.config.appId}/tables/${options.tableName}/Action`;

    const payload = {
      Action: 'Add',
      Properties: options.properties || {},
      Rows: options.rows,
    };

    const response = await this.request<ApiResponse<T>>(url, payload);

    return {
      rows: response.Rows || [],
      warnings: response.Warnings,
    };
  }

  /**
   * Find (Read) rows from a table with optional filtering.
   *
   * @template T - The type of the rows being retrieved
   * @param options - Options for the find operation
   * @returns Promise resolving to the found rows
   * @throws {AuthenticationError} If authentication fails
   * @throws {NotFoundError} If the table doesn't exist
   * @throws {NetworkError} If the request fails due to network issues
   *
   * @example
   * ```typescript
   * // Find all rows
   * const all = await client.find({ tableName: 'Users' });
   *
   * // Find with filter
   * const active = await client.find({
   *   tableName: 'Users',
   *   selector: '[Status] = "Active"'
   * });
   * ```
   */
  async find<T = Record<string, any>>(options: FindOptions): Promise<FindResponse<T>> {
    const url = `/apps/${this.config.appId}/tables/${options.tableName}/Action`;

    const properties = options.properties || {};
    if (options.selector) {
      properties.Selector = options.selector;
    }

    const payload = {
      Action: 'Find',
      Properties: properties,
      Rows: [],
    };

    const response = await this.request<ApiResponse<T>>(url, payload);

    return {
      rows: response.Rows || [],
      warnings: response.Warnings,
    };
  }

  /**
   * Update (Edit) one or more rows in a table.
   *
   * Rows must include the key field (primary key) to identify which row to update.
   *
   * @template T - The type of the rows being updated
   * @param options - Options for the update operation
   * @returns Promise resolving to the updated rows
   * @throws {AuthenticationError} If authentication fails
   * @throws {ValidationError} If the data is invalid or key field is missing
   * @throws {NotFoundError} If the row to update doesn't exist
   * @throws {NetworkError} If the request fails due to network issues
   *
   * @example
   * ```typescript
   * const updated = await client.update({
   *   tableName: 'Users',
   *   rows: [
   *     { id: '123', name: 'John Updated' },
   *     { id: '456', status: 'Inactive' }
   *   ]
   * });
   * ```
   */
  async update<T = Record<string, any>>(options: UpdateOptions<T>): Promise<UpdateResponse<T>> {
    const url = `/apps/${this.config.appId}/tables/${options.tableName}/Action`;

    const payload = {
      Action: 'Edit',
      Properties: options.properties || {},
      Rows: options.rows,
    };

    const response = await this.request<ApiResponse<T>>(url, payload);

    return {
      rows: response.Rows || [],
      warnings: response.Warnings,
    };
  }

  /**
   * Delete one or more rows from a table.
   *
   * Rows must include the key field (primary key) to identify which row to delete.
   *
   * @template T - The type of the rows being deleted
   * @param options - Options for the delete operation
   * @returns Promise resolving to deletion result with count
   * @throws {AuthenticationError} If authentication fails
   * @throws {ValidationError} If the key field is missing
   * @throws {NotFoundError} If the row to delete doesn't exist
   * @throws {NetworkError} If the request fails due to network issues
   *
   * @example
   * ```typescript
   * await client.delete({
   *   tableName: 'Users',
   *   rows: [
   *     { id: '123' },
   *     { id: '456' }
   *   ]
   * });
   * ```
   */
  async delete<T = Record<string, any>>(options: DeleteOptions<T>): Promise<DeleteResponse> {
    const url = `/apps/${this.config.appId}/tables/${options.tableName}/Action`;

    const payload = {
      Action: 'Delete',
      Properties: options.properties || {},
      Rows: options.rows,
    };

    const response = await this.request<ApiResponse<T>>(url, payload);

    return {
      success: true,
      deletedCount: options.rows.length,
      warnings: response.Warnings,
    };
  }

  /**
   * Convenience method to find all rows in a table without filtering.
   *
   * @template T - The type of the rows being retrieved
   * @param tableName - Name of the table to query
   * @returns Promise resolving to array of all rows
   *
   * @example
   * ```typescript
   * const allUsers = await client.findAll<User>('Users');
   * ```
   */
  async findAll<T = Record<string, any>>(tableName: string): Promise<T[]> {
    const response = await this.find<T>({ tableName });
    return response.rows;
  }

  /**
   * Convenience method to find a single row by selector.
   *
   * Returns the first matching row or null if not found.
   *
   * @template T - The type of the row being retrieved
   * @param tableName - Name of the table to query
   * @param selector - AppSheet selector expression
   * @returns Promise resolving to the found row or null
   *
   * @example
   * ```typescript
   * const user = await client.findOne<User>(
   *   'Users',
   *   '[Email] = "john@example.com"'
   * );
   * if (user) {
   *   console.log('Found user:', user.name);
   * }
   * ```
   */
  async findOne<T = Record<string, any>>(
    tableName: string,
    selector: string
  ): Promise<T | null> {
    const response = await this.find<T>({ tableName, selector });
    return response.rows[0] || null;
  }

  /**
   * Convenience method to add a single row to a table.
   *
   * @template T - The type of the row being added
   * @param tableName - Name of the table
   * @param row - The row data to add
   * @returns Promise resolving to the created row
   *
   * @example
   * ```typescript
   * const newUser = await client.addOne('Users', {
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   * console.log('Created user with ID:', newUser.id);
   * ```
   */
  async addOne<T = Record<string, any>>(tableName: string, row: T): Promise<T> {
    const response = await this.add<T>({ tableName, rows: [row] });
    return response.rows[0];
  }

  /**
   * Convenience method to update a single row in a table.
   *
   * @template T - The type of the row being updated
   * @param tableName - Name of the table
   * @param row - The row data to update (must include key field)
   * @returns Promise resolving to the updated row
   *
   * @example
   * ```typescript
   * const updated = await client.updateOne('Users', {
   *   id: '123',
   *   name: 'John Updated'
   * });
   * ```
   */
  async updateOne<T = Record<string, any>>(tableName: string, row: T): Promise<T> {
    const response = await this.update<T>({ tableName, rows: [row] });
    return response.rows[0];
  }

  /**
   * Convenience method to delete a single row from a table.
   *
   * @template T - The type of the row being deleted
   * @param tableName - Name of the table
   * @param row - The row to delete (must include key field)
   * @returns Promise resolving to true if successful
   *
   * @example
   * ```typescript
   * await client.deleteOne('Users', { id: '123' });
   * console.log('User deleted');
   * ```
   */
  async deleteOne<T = Record<string, any>>(tableName: string, row: T): Promise<boolean> {
    await this.delete<T>({ tableName, rows: [row] });
    return true;
  }

  /**
   * Execute request with retry logic and error handling
   */
  private async request<T>(url: string, payload: any, attempt = 1): Promise<T> {
    try {
      const response = await this.axios.post<T>(url, payload);
      return response.data;
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;

        // Retry on network errors or 5xx server errors
        if (
          attempt < this.config.retryAttempts &&
          (this.isRetryableError(axiosError) || this.isServerError(axiosError))
        ) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
          return this.request<T>(url, payload, attempt + 1);
        }

        // Convert to appropriate error type
        throw this.convertError(axiosError);
      }

      // Re-throw unknown errors
      throw error;
    }
  }

  /**
   * Check if error is retryable (network error)
   */
  private isRetryableError(error: AxiosError): boolean {
    return !error.response || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  }

  /**
   * Check if error is a server error (5xx)
   */
  private isServerError(error: AxiosError): boolean {
    return !!error.response && error.response.status >= 500;
  }

  /**
   * Convert axios error to AppSheet error
   */
  private convertError(error: AxiosError): AppSheetError {
    const status = error.response?.status;
    const data: any = error.response?.data;
    const message = data?.error || data?.message || error.message || 'Unknown error';

    switch (status) {
      case 401:
      case 403:
        return new AuthenticationError(message, data);

      case 400:
        return new ValidationError(message, data);

      case 404:
        return new NotFoundError(message, data);

      case 429:
        return new RateLimitError(message, data);

      default:
        if (!error.response) {
          return new NetworkError(message, { code: error.code });
        }
        return new AppSheetError(message, 'API_ERROR', status, data);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the current client configuration.
   *
   * Returns a readonly copy of the configuration with all defaults applied.
   *
   * @returns The client configuration
   */
  getConfig(): Readonly<Required<AppSheetConfig>> {
    return { ...this.config };
  }
}
