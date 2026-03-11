/**
 * StripUnknownFieldPolicy - Remove unknown fields before API call (Default)
 *
 * Removes fields from row objects that are not defined in the table schema.
 * This is the default policy and the safest option for production use.
 *
 * @module utils/policies
 * @category Policies
 */

import { UnknownFieldPolicyInterface } from '../../types/policies';

/**
 * Policy that strips unknown fields from rows before sending to the API.
 *
 * This is the **default policy** used by DynamicTable and DynamicTableFactory.
 * It silently removes any fields not defined in the table schema, preventing
 * API errors caused by invalid field names.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { StripUnknownFieldPolicy } from '@techdivision/appsheet';
 *
 * const policy = new StripUnknownFieldPolicy();
 * const result = policy.apply('solution', [
 *   { solution_id: '1', name: 'Test', unknown_field: 'value' }
 * ], ['solution_id', 'name']);
 * // result: [{ solution_id: '1', name: 'Test' }]
 * ```
 */
export class StripUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  /**
   * Returns new row objects with only known fields, stripping unknown ones.
   *
   * @param tableName - The AppSheet table name (unused, available for subclasses)
   * @param rows - The row objects to process
   * @param knownFields - Array of field names defined in the table schema
   * @returns New row objects containing only known fields
   */
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    knownFields: string[]
  ): Partial<T>[] {
    const knownSet = new Set(knownFields);
    return rows.map((row) => {
      const cleaned = {} as Partial<T>;
      for (const [key, value] of Object.entries(row)) {
        if (knownSet.has(key)) {
          (cleaned as Record<string, any>)[key] = value;
        }
      }
      return cleaned;
    });
  }
}
