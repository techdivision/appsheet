/**
 * Unknown Field Policy Interface
 *
 * Defines how DynamicTable handles fields in row objects that are not
 * defined in the table schema. Implementations decide what happens:
 * ignore them, strip them, throw an error, or custom behavior.
 *
 * Analog to SelectorBuilderInterface — injectable via DynamicTableFactory constructor.
 *
 * @module types
 * @category Types
 */

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
