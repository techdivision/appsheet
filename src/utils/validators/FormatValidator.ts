/**
 * Format validation utilities for specialized field types
 * @module utils
 * @category Validation
 */

import { ValidationError } from '../../types';

/**
 * Validates format-specific constraints for AppSheet field types.
 *
 * Provides validation methods for Email, URL, Phone, and other format-specific types.
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
   * Validate date format (YYYY-MM-DD)
   */
  static validateDateFormat(fieldName: string, value: string, rowIndex: number): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid date string (YYYY-MM-DD)`,
        { fieldName, value }
      );
    }
  }

  /**
   * Validate datetime format (ISO 8601)
   */
  static validateDateTimeFormat(fieldName: string, value: string, rowIndex: number): void {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a valid datetime string (ISO 8601)`,
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
