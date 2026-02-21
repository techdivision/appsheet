/**
 * Configuration types for AppSheet client
 * @module types
 * @category Types
 */

/**
 * AppSheet client configuration.
 *
 * @deprecated Since v3.0.0 - Use {@link ConnectionDefinition} instead.
 * The AppSheetClient constructor now takes (ConnectionDefinition, runAsUserEmail).
 *
 * @category Types
 */
export interface AppSheetConfig {
  /** AppSheet App ID */
  appId: string;

  /** Application Access Key for authentication */
  applicationAccessKey: string;

  /** Optional custom API base URL (default: https://www.appsheet.com/api/v2) */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Number of retry attempts for failed requests (default: 3) */
  retryAttempts?: number;

  /** Optional email of user to run all operations as (can be overridden per operation) */
  runAsUserEmail?: string;
}

/**
 * Connection configuration for ConnectionManager
 *
 * @deprecated Since v3.0.0 - ConnectionManager now uses factory injection.
 * Use ConnectionManager(clientFactory, schema) constructor instead.
 *
 * @category Types
 */
export interface ConnectionConfig extends AppSheetConfig {
  /** Unique name for this connection */
  name: string;
}

/**
 * Request properties that can be sent with operations
 */
export interface RequestProperties {
  /** Locale for the request (e.g., "de-DE", "en-US") */
  Locale?: string;

  /** Geographic location "latitude,longitude" */
  Location?: string;

  /** Timezone (e.g., "Europe/Berlin", "America/New_York") */
  Timezone?: string;

  /** User ID making the request */
  UserId?: string;

  /** Email of user to run the operation as */
  RunAsUserEmail?: string;

  /** Selector/filter expression (for Find operations) */
  Selector?: string;
}
