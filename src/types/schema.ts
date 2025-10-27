/**
 * Schema types for runtime configuration
 * @module types
 * @category Types
 */

/**
 * Supported field data types in schema definitions.
 * @category Types
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

/**
 * Field definition with optional validation metadata.
 *
 * Defines a table field with type information and optional validation rules.
 *
 * @category Types
 */
export interface FieldDefinition {
  /** Field data type */
  type: FieldType;

  /** Whether the field is required */
  required?: boolean;

  /** Allowed values for enum fields */
  enum?: string[];

  /** Field description */
  description?: string;
}

/**
 * Table definition in schema
 */
export interface TableDefinition {
  /** Actual AppSheet table name */
  tableName: string;

  /** Name of the key/primary field */
  keyField: string;

  /** Field definitions (name -> type or full definition) */
  fields: Record<string, string | FieldDefinition>;
}

/**
 * Connection definition in schema
 */
export interface ConnectionDefinition {
  /** AppSheet App ID */
  appId: string;

  /** Application Access Key */
  applicationAccessKey: string;

  /** Optional custom base URL */
  baseUrl?: string;

  /** Optional request timeout */
  timeout?: number;

  /** Table definitions for this connection */
  tables: Record<string, TableDefinition>;
}

/**
 * Complete schema configuration
 */
export interface SchemaConfig {
  /** Named connections */
  connections: Record<string, ConnectionDefinition>;
}

/**
 * Result from table inspection
 */
export interface TableInspectionResult {
  /** Table name */
  tableName: string;

  /** Inferred key field */
  keyField: string;

  /** Discovered fields */
  fields: Record<string, string>;

  /** Optional warning message */
  warning?: string;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Whether schema is valid */
  valid: boolean;

  /** Validation error messages */
  errors: string[];
}
