/**
 * Format validation utilities for specialized field types
 * @module utils
 * @category Validation
 */

import { ValidationError } from '../../types';

// ============================================
// Locale-aware date format detection via Intl
// ============================================

/**
 * Describes the date format for a specific locale, dynamically detected
 * via `Intl.DateTimeFormat.formatToParts()`.
 *
 * @category Validation
 */
export interface DateFormatInfo {
  /** Order of date parts, e.g. ['month','day','year'] for en-US */
  partOrder: ('day' | 'month' | 'year')[];
  /** Separator character, e.g. '/' or '.' */
  separator: string;
  /** Example date formatted in the locale, e.g. "12/25/2026" — for error messages */
  exampleDate: string;
  /** Example datetime formatted in the locale, e.g. "12/25/2026 14:30:00" */
  exampleDateTime: string;
}

/** Cache: computed once per locale, then reused */
const formatCache = new Map<string, DateFormatInfo>();

/** ISO 8601 patterns — always accepted regardless of locale */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Dynamically determines the date format for any locale via
 * `Intl.DateTimeFormat.formatToParts()`.
 *
 * Supports ALL locales that the JavaScript runtime knows (hundreds).
 * Results are cached per locale.
 *
 * @param locale - BCP 47 language tag (e.g. 'de-DE', 'en-US', 'ja-JP')
 * @returns DateFormatInfo with part order, separator, and example strings
 *
 * @category Validation
 */
export function getLocaleDateFormat(locale: string): DateFormatInfo {
  const cached = formatCache.get(locale);
  if (cached) return cached;

  // Reference date: day=25, month=12, year=2026 — all different,
  // so the order is unambiguously detectable
  const refDate = new Date(2026, 11, 25, 14, 30, 0);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dateFmt.formatToParts(refDate);
  const partOrder = parts
    .filter((p) => ['day', 'month', 'year'].includes(p.type))
    .map((p) => p.type as 'day' | 'month' | 'year');
  const separator = parts.find((p) => p.type === 'literal')?.value || '/';

  const info: DateFormatInfo = {
    partOrder,
    separator,
    exampleDate: dateFmt.format(refDate),
    exampleDateTime: dateTimeFmt.format(refDate),
  };

  formatCache.set(locale, info);
  return info;
}

/**
 * Validates whether string parts represent valid day/month/year values.
 * Performs semantic validation (month 1-12, day 1-31, year 1900-9999).
 */
function validateDateParts(parts: string[], order: ('day' | 'month' | 'year')[]): boolean {
  const mapped: Record<string, number> = {};
  for (let i = 0; i < order.length; i++) {
    const num = parseInt(parts[i], 10);
    if (isNaN(num)) return false;
    mapped[order[i]] = num;
  }
  return (
    mapped.year >= 1900 &&
    mapped.year <= 9999 &&
    mapped.month >= 1 &&
    mapped.month <= 12 &&
    mapped.day >= 1 &&
    mapped.day <= 31
  );
}

/**
 * Validates whether a time string is valid (HH:mm or HH:mm:ss).
 */
function isValidTimePart(time: string): boolean {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(time);
}

/**
 * Permissive check: does the string look like a date?
 * Common separators: /, ., -
 * Accepts if 3 numeric parts are present.
 */
function isPlausibleDateString(value: string): boolean {
  const parts = value.split(/[/.-]/);
  if (parts.length !== 3) return false;
  return parts.every((p) => /^\d{1,4}$/.test(p));
}

/**
 * Permissive check: does the string look like a datetime?
 * Expects date + space + time.
 */
function isPlausibleDateTimeString(value: string): boolean {
  const spaceIndex = value.indexOf(' ');
  if (spaceIndex <= 0) return false;
  const datePart = value.substring(0, spaceIndex);
  const timePart = value.substring(spaceIndex + 1);
  return isPlausibleDateString(datePart) && isValidTimePart(timePart);
}

/**
 * Validates format-specific constraints for AppSheet field types.
 *
 * Provides validation methods for Email, URL, Phone, Date, DateTime,
 * and other format-specific types. Date/DateTime validation supports
 * locale-aware formats via `Intl.DateTimeFormat`.
 *
 * @category Validation
 */
export class FormatValidator {
  /**
   * Validate email format (RFC 5322 basic check)
   */
  static validateEmail(fieldName: string, value: string, rowIndex: number): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid email address, got: ${value}`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate URL format
   */
  static validateURL(fieldName: string, value: string, rowIndex: number): void {
    try {
      new URL(value);
    } catch {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid URL, got: ${value}`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate phone number format (flexible international format)
   */
  static validatePhone(fieldName: string, value: string, rowIndex: number): void {
    // Basic phone validation: digits, spaces, +, -, (, )
    if (!/^[\d\s+\-()]+$/.test(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid phone number, got: ${value}`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate date format with optional locale-aware validation.
   *
   * Three-tier validation logic:
   * 1. ISO 8601 (YYYY-MM-DD) is ALWAYS accepted as fallback
   * 2. With locale: dynamically validates against locale-specific format
   * 3. Without locale: permissive mode — accepts any plausible date string
   *
   * @param fieldName - Name of the field being validated
   * @param value - The date string to validate
   * @param rowIndex - Row index for error messages
   * @param locale - Optional BCP 47 locale tag (e.g. 'de-DE', 'en-US')
   */
  static validateDateFormat(
    fieldName: string,
    value: string,
    rowIndex: number,
    locale?: string
  ): void {
    // 1. ISO 8601 always accepted
    if (ISO_DATE.test(value)) return;

    if (locale) {
      // 2. With locale: dynamically determine format and validate
      const fmt = getLocaleDateFormat(locale);
      const dateParts = value.split(fmt.separator);
      if (dateParts.length === 3 && validateDateParts(dateParts, fmt.partOrder)) {
        return;
      }

      // Locale format not recognized → error with example
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid date ` +
          `(expected: ${fmt.exampleDate} or YYYY-MM-DD), got: "${value}"`,
        { fieldName, value, locale }
      );
    }

    // 3. Without locale → permissive mode: accept if plausible
    if (!isPlausibleDateString(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid date string, got: "${value}"`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate datetime format with optional locale-aware validation.
   *
   * Three-tier validation logic:
   * 1. ISO 8601 (YYYY-MM-DDT...) is ALWAYS accepted as fallback
   * 2. With locale: validates date part against locale format + time part
   * 3. Without locale: permissive mode — accepts any plausible datetime string
   *
   * @param fieldName - Name of the field being validated
   * @param value - The datetime string to validate
   * @param rowIndex - Row index for error messages
   * @param locale - Optional BCP 47 locale tag (e.g. 'de-DE', 'en-US')
   */
  static validateDateTimeFormat(
    fieldName: string,
    value: string,
    rowIndex: number,
    locale?: string
  ): void {
    // 1. ISO 8601 always accepted
    if (ISO_DATETIME.test(value)) return;

    if (locale) {
      // 2. With locale: date part before space, time part after
      const fmt = getLocaleDateFormat(locale);
      const spaceIndex = value.indexOf(' ');
      if (spaceIndex > 0) {
        const datePart = value.substring(0, spaceIndex);
        const timePart = value.substring(spaceIndex + 1);
        const dateParts = datePart.split(fmt.separator);
        if (
          dateParts.length === 3 &&
          validateDateParts(dateParts, fmt.partOrder) &&
          isValidTimePart(timePart)
        ) {
          return;
        }
      }

      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid datetime ` +
          `(expected: ${fmt.exampleDateTime} or ISO 8601), got: "${value}"`,
        { fieldName, value, locale }
      );
    }

    // 3. Without locale → permissive mode
    if (!isPlausibleDateTimeString(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid datetime string, got: "${value}"`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate percentage range (0.00 to 1.00)
   */
  static validatePercentRange(fieldName: string, value: number, rowIndex: number): void {
    if (value < 0 || value > 1) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a percentage between 0.00 and 1.00, got: ${value}`,
        { fieldName, value }
      );
    }
  }
}
