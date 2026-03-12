/**
 * Policy interfaces for DynamicTable behavior customization
 *
 * Defines injectable policies for:
 * - Unknown field handling (strip, ignore, error)
 * - Write value conversion (no-op, locale date formatting)
 *
 * Both follow the Strategy Pattern, injectable via DynamicTable/DynamicTableFactory constructor.
 *
 * @module types
 * @category Types
 */

import { FieldDefinition } from './schema';

/**
 * Interface for handling fields in row objects that are not defined in the table schema.
 *
 * Implementations decide what happens when a row contains fields that are not
 * in the schema: ignore them, strip them, throw an error, or custom behavior.
 *
 * Analog to SelectorBuilderInterface — injectable via DynamicTableFactory constructor.
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Use built-in policies
 * import { StripUnknownFieldPolicy, ErrorUnknownFieldPolicy } from '@techdivision/appsheet';
 *
 * // Or create a custom policy
 * class LoggingStripPolicy implements UnknownFieldPolicyInterface {
 *   apply<T extends Record<string, any>>(
 *     tableName: string,
 *     rows: Partial<T>[],
 *     knownFields: string[]
 *   ): Partial<T>[] {
 *     // Custom logging logic here
 *     return new StripUnknownFieldPolicy().apply(tableName, rows, knownFields);
 *   }
 * }
 * ```
 */
export interface UnknownFieldPolicyInterface {
  /**
   * Process rows and handle any fields not defined in the table schema.
   *
   * @param tableName - The AppSheet table name (for error messages)
   * @param rows - The row objects to process
   * @param knownFields - Array of field names defined in the table schema
   * @returns Processed rows (may be modified, filtered, or unchanged)
   * @throws {ValidationError} If the policy rejects unknown fields (e.g. ErrorUnknownFieldPolicy)
   */
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[];
}

/**
 * Interface for converting field values before sending to the AppSheet API.
 *
 * Implementations can convert values to locale-specific formats (e.g., ISO dates
 * to locale dates), normalize values, or perform any other pre-write transformation.
 *
 * The policy is applied AFTER validation but BEFORE sending to the API,
 * ensuring only valid values are converted.
 *
 * Analog to UnknownFieldPolicyInterface — injectable via DynamicTable/DynamicTableFactory constructor.
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Use built-in policies
 * import { NoOpWriteConversionPolicy, LocaleWriteConversionPolicy } from '@techdivision/appsheet';
 *
 * // Or create a custom policy
 * class CustomWriteConversionPolicy implements WriteConversionPolicyInterface {
 *   apply<T extends Record<string, any>>(
 *     tableName: string,
 *     rows: Partial<T>[],
 *     fields: Record<string, FieldDefinition>,
 *     locale?: string
 *   ): Partial<T>[] {
 *     // Custom conversion logic here
 *     return rows;
 *   }
 * }
 * ```
 */
export interface WriteConversionPolicyInterface {
  /**
   * Convert field values in rows before sending to the AppSheet API.
   *
   * @param tableName - The AppSheet table name (for context)
   * @param rows - The validated row objects to convert
   * @param fields - Field definitions from the table schema (includes field types)
   * @param locale - Optional BCP 47 locale tag for locale-aware conversion
   * @returns Converted rows (may have transformed field values)
   */
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    fields: Record<string, FieldDefinition>,
    locale?: string
  ): Partial<T>[];
}
