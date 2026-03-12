/**
 * LocaleWriteConversionPolicy - Convert ISO dates to locale format before API call
 *
 * Converts ISO 8601 date/datetime values to locale-specific format using
 * the `getLocaleDateFormat()` function from SOSO-439. Only ISO-formatted
 * values are converted; values already in locale format pass through unchanged.
 *
 * @module utils/policies
 * @category Policies
 */

import { FieldDefinition } from '../../types/schema';
import { WriteConversionPolicyInterface } from '../../types/policies';
import { getLocaleDateFormat, DateFormatInfo } from '../validators';

/** AppSheet field types that contain date values */
const DATE_TYPES = new Set(['Date', 'DateTime', 'ChangeTimestamp']);

/** ISO 8601 date pattern: YYYY-MM-DD */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601 datetime pattern: YYYY-MM-DDT... */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Policy that converts ISO 8601 date/datetime values to locale-specific format
 * before sending to the AppSheet API.
 *
 * Only converts values that are in ISO format. Values already in locale format
 * or other formats are passed through unchanged. This ensures safe round-trip
 * behavior: data read from AppSheet (in locale format) can be sent back
 * unchanged via update().
 *
 * Requires a locale to be set. Without locale, acts as no-op.
 *
 * @category Policies
 *
 * @example
 * ```typescript
 * import { LocaleWriteConversionPolicy, DynamicTableFactory } from '@techdivision/appsheet';
 *
 * const factory = new DynamicTableFactory(
 *   clientFactory,
 *   schema,
 *   undefined,                          // default unknown field policy
 *   new LocaleWriteConversionPolicy()   // convert dates on write
 * );
 *
 * const table = factory.create('default', 'worklogs', 'user@example.com');
 * // table.add([{ date: '2026-03-12' }])
 * // → AppSheet receives: { date: "12.03.2026" } (if locale is de-DE)
 * ```
 */
export class LocaleWriteConversionPolicy implements WriteConversionPolicyInterface {
  /**
   * Converts ISO date/datetime values to locale format in all rows.
   *
   * @param tableName - The AppSheet table name (unused, available for subclasses)
   * @param rows - The validated row objects to convert
   * @param fields - Field definitions from the table schema
   * @param locale - Optional BCP 47 locale tag for locale-aware conversion
   * @returns New row objects with ISO dates converted to locale format
   */
  apply<T extends Record<string, any>>(
    _tableName: string,
    rows: Partial<T>[],
    fields: Record<string, FieldDefinition>,
    locale?: string
  ): Partial<T>[] {
    // Without locale, no conversion possible
    if (!locale) return rows;

    const fmt = getLocaleDateFormat(locale);

    return rows.map((row) => {
      const converted = { ...row } as Record<string, any>;
      let changed = false;

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (!DATE_TYPES.has(fieldDef.type)) continue;

        const value = converted[fieldName];
        if (typeof value !== 'string') continue;

        const newValue = this.convertDateValue(value, fieldDef.type, fmt);
        if (newValue !== value) {
          converted[fieldName] = newValue;
          changed = true;
        }
      }

      return (changed ? converted : row) as Partial<T>;
    });
  }

  /**
   * Converts a single date/datetime value from ISO to locale format.
   * Returns the original value if it's not in ISO format.
   */
  private convertDateValue(value: string, fieldType: string, fmt: DateFormatInfo): string {
    if (fieldType === 'Date' && ISO_DATE.test(value)) {
      return this.isoDateToLocale(value, fmt);
    }

    if ((fieldType === 'DateTime' || fieldType === 'ChangeTimestamp') && ISO_DATETIME.test(value)) {
      return this.isoDateTimeToLocale(value, fmt);
    }

    // Not ISO format — pass through unchanged (e.g., round-trip from find())
    return value;
  }

  /**
   * Converts ISO date (YYYY-MM-DD) to locale format.
   *
   * @example
   * isoDateToLocale("2026-03-12", deDE) → "12.03.2026"
   * isoDateToLocale("2026-03-12", enUS) → "03/12/2026"
   * isoDateToLocale("2026-03-12", jaJP) → "2026/03/12"
   */
  private isoDateToLocale(isoDate: string, fmt: DateFormatInfo): string {
    const [year, month, day] = isoDate.split('-');
    const parts: Record<string, string> = { year, month, day };
    return fmt.partOrder.map((p) => parts[p]).join(fmt.separator);
  }

  /**
   * Converts ISO datetime (YYYY-MM-DDT...) to locale format.
   *
   * @example
   * isoDateTimeToLocale("2026-03-12T14:30:00.000Z", deDE) → "12.03.2026 14:30:00"
   * isoDateTimeToLocale("2026-03-12T14:30:00Z", enUS)     → "03/12/2026 14:30:00"
   */
  private isoDateTimeToLocale(isoDateTime: string, fmt: DateFormatInfo): string {
    // Parse: "2026-03-12T14:30:00.000Z" or "2026-03-12T14:30:00+02:00"
    const tIndex = isoDateTime.indexOf('T');
    const datePart = isoDateTime.substring(0, tIndex);
    let timePart = isoDateTime.substring(tIndex + 1);

    // Strip timezone suffix (Z, +HH:MM, -HH:MM)
    timePart = timePart.replace(/Z$/i, '').replace(/[+-]\d{2}:\d{2}$/, '');

    // Strip milliseconds (.000)
    timePart = timePart.replace(/\.\d+$/, '');

    const localDate = this.isoDateToLocale(datePart, fmt);
    return `${localDate} ${timePart}`;
  }
}
