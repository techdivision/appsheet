/**
 * Schema types for runtime configuration
 * @module types
 * @category Types
 */

/**
 * AppSheet-specific field data types.
 *
 * Represents all column types supported by AppSheet API.
 *
 * @category Types
 * @see https://support.google.com/appsheet/answer/10106435
 */
export type AppSheetFieldType =
  // Core types
  | 'Text'
  | 'Number'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'Duration'
  | 'YesNo'
  // Specialized text types
  | 'Name'
  | 'Email'
  | 'URL'
  | 'Phone'
  | 'Address'
  // Specialized number types
  | 'Decimal'
  | 'Percent'
  | 'Price'
  // Selection types
  | 'Enum'
  | 'EnumList'
  // Media types
  | 'Image'
  | 'File'
  | 'Drawing'
  | 'Signature'
  // Tracking types
  | 'ChangeCounter'
  | 'ChangeTimestamp'
  | 'ChangeLocation'
  // Reference types
  | 'Ref'
  | 'RefList'
  // Special types
  | 'Color'
  | 'Show';

/**
 * Field definition with AppSheet-specific type information and validation rules.
 *
 * Defines a table field with AppSheet type information and optional validation metadata.
 * All fields must use the full object definition format with explicit type property.
 *
 * @category Types
 *
 * @example
 * ```typescript
 * const fieldDef: FieldDefinition = {
 *   type: 'Email',
 *   required: true,
 *   description: 'User email address'
 * };
 *
 * const enumFieldDef: FieldDefinition = {
 *   type: 'Enum',
 *   required: true,
 *   allowedValues: ['Active', 'Inactive', 'Pending']
 * };
 * ```
 */
export interface FieldDefinition {
  /** AppSheet field type (required) */
  type: AppSheetFieldType;

  /** Whether the field is required (default: false) */
  required?: boolean;

  /** Allowed values for Enum/EnumList fields */
  allowedValues?: string[];

  /** Referenced table name for Ref/RefList fields */
  referencedTable?: string;

  /** Field description */
  description?: string;

  /** Additional AppSheet-specific configuration */
  appSheetConfig?: {
    /** Allow other values (for Enum) */
    allowOtherValues?: boolean;

    /** Format hint for display */
    format?: string;

    /** Default value */
    defaultValue?: any;
  };
}

/**
 * Table definition in schema.
 *
 * Defines a table structure with AppSheet-specific field types and validation rules.
 * All fields must use the FieldDefinition object format (no shorthand strings).
 *
 * @category Types
 *
 * @example
 * ```typescript
 * const tableDef: TableDefinition = {
 *   tableName: 'extract_user',
 *   keyField: 'id',
 *   fields: {
 *     id: { type: 'Text', required: true },
 *     email: { type: 'Email', required: true },
 *     age: { type: 'Number', required: false },
 *     status: {
 *       type: 'Enum',
 *       required: true,
 *       allowedValues: ['Active', 'Inactive']
 *     }
 *   }
 * };
 * ```
 */
export interface TableDefinition {
  /** Actual AppSheet table name */
  tableName: string;

  /** Name of the key/primary field */
  keyField: string;

  /** Field definitions (name -> FieldDefinition object only) */
  fields: Record<string, FieldDefinition>;
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
 * Result from table inspection.
 *
 * Contains discovered table structure with inferred AppSheet field types.
 *
 * @category Types
 */
export interface TableInspectionResult {
  /** Table name */
  tableName: string;

  /** Inferred key field */
  keyField: string;

  /** Discovered fields with AppSheet types */
  fields: Record<string, FieldDefinition>;

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
