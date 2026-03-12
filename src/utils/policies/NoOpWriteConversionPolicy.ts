/**
 * NoOpWriteConversionPolicy - Pass rows through without conversion (Default)
 *
 * Does not modify any field values. This is the default policy,
 * maintaining backward compatibility with existing behavior.
 *
 * @module utils/policies
 * @category Policies
 */

import { FieldDefinition } from '../../types/schema';
import { WriteConversionPolicyInterface } from '../../types/policies';

/**
 * Policy that passes rows through without any value conversion.
 *
 * This is the **default policy** used by DynamicTable and DynamicTableFactory.
 * It does not modify any field values, maintaining backward compatibility.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { NoOpWriteConversionPolicy } from '@techdivision/appsheet';
 *
 * const policy = new NoOpWriteConversionPolicy();
 * const result = policy.apply('worklogs', [
 *   { date: '2026-03-12', name: 'Test' }
 * ], { date: { type: 'Date' }, name: { type: 'Text' } }, 'de-DE');
 * // result: [{ date: '2026-03-12', name: 'Test' }]  — unchanged
 * ```
 */
export class NoOpWriteConversionPolicy implements WriteConversionPolicyInterface {
  /**
   * Returns rows unchanged — no value conversion is performed.
   *
   * @param tableName - The AppSheet table name (unused)
   * @param rows - The row objects to process
   * @param fields - Field definitions from the table schema (unused)
   * @param locale - Optional BCP 47 locale tag (unused)
   * @returns The original rows without modification
   */
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    _fields: Record<string, FieldDefinition>,
    _locale?: string
  ): Partial<T>[] {
    return rows;
  }
}
