/**
 * Configuration types for AppSheet client
 * @module types
 * @category Types
 */

/**
 * AppSheet client configuration.
 *
 * Configuration options for creating an AppSheet API client.
 *
 * @category Types
 */
export interface AppSheetConfig {
  /** AppSheet App ID */
  appId: string;

  /** Application Access Key for authentication */
  applicationAccessKey: string;

  /** Optional custom API base URL (default: https://api.appsheet.com/api/v2) */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Number of retry attempts for failed requests (default: 3) */
  retryAttempts?: number;
}

/**
 * Connection configuration for ConnectionManager
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
