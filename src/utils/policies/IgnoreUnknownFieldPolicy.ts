/**
 * IgnoreUnknownFieldPolicy - Pass rows through unchanged
 *
 * Does not modify rows. Unknown fields are passed to the AppSheet API as-is.
 * Use this for legacy code or migration scenarios where unknown fields are expected.
 *
 * @module utils/policies
 * @category Policies
 */

import { UnknownFieldPolicyInterface } from '../../types/policies';

/**
 * Policy that ignores unknown fields and passes rows through unchanged.
 *
 * Unknown fields are sent to the AppSheet API as-is. This is the least safe
 * option but useful for legacy code or migration scenarios.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { IgnoreUnknownFieldPolicy, DynamicTableFactory } from '@techdivision/appsheet';
 *
 * const factory = new DynamicTableFactory(
 *   clientFactory,
 *   schema,
 *   new IgnoreUnknownFieldPolicy()
 * );
 * ```
 */
export class IgnoreUnknownFieldPolicy implements UnknownFieldPolicyInterface {
  /**
   * Returns rows unchanged — unknown fields are not modified.
   *
   * @param tableName - The AppSheet table name (unused)
   * @param rows - The row objects to process
   * @param knownFields - Array of known field names (unused)
   * @returns The original rows without modification
   */
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    _knownFields: string[]
  ): Partial<T>[] {
    return rows;
  }
}
