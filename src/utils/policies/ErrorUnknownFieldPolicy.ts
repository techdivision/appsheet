/**
 * ErrorUnknownFieldPolicy - Throw ValidationError for unknown fields
 *
 * Throws a ValidationError when rows contain fields not defined in the table schema.
 * Use this for strict validation in CI/CD pipelines or development environments.
 *
 * @module utils/policies
 * @category Policies
 */

import { UnknownFieldPolicyInterface } from '../../types/policies';
import { ValidationError } from '../../types/errors';

/**
 * Policy that throws a ValidationError when unknown fields are detected.
 *
 * This is the strictest policy. Any field in a row that is not defined in the
 * table schema will cause a ValidationError to be thrown immediately.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { ErrorUnknownFieldPolicy, DynamicTableFactory } from '@techdivision/appsheet';
 *
 * // Strict mode for CI/CD
 * const factory = new DynamicTableFactory(
 *   clientFactory,
 *   schema,
 *   new ErrorUnknownFieldPolicy()
 * );
 *
 * // Will throw: Unknown fields in table "solution" (row 0): id
 * await table.add([{ solution_id: '1', id: '1' }]);
 * ```
 */
export class ErrorUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  /**
   * Validates that all fields in each row are defined in the schema.
   * Throws ValidationError if any unknown fields are found.
   *
   * @param tableName - The AppSheet table name (used in error messages)
   * @param rows - The row objects to validate
   * @param knownFields - Array of field names defined in the table schema
   * @returns The original rows if no unknown fields are found
   * @throws {ValidationError} If any row contains fields not in knownFields
   */
  apply<T extends Record<string, any>>(
    tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    const knownSet = new Set(knownFields);
    for (let i = 0; i < rows.length; i++) {
      const unknownFields = Object.keys(rows[i]).filter((key) => !knownSet.has(key));
      if (unknownFields.length > 0) {
        throw new ValidationError(
          `Unknown fields in table "${tableName}" (row ${i}): ${unknownFields.join(', ')}. ` +
            `These fields are not defined in the schema. ` +
            `Remove them or update the schema to include them.`,
          { tableName, unknownFields, rowIndex: i }
        );
      }
    }
    return rows;
  }
}
