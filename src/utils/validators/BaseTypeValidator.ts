/**
 * Base type validation for JavaScript primitive types
 * @module utils
 * @category Validation
 */

import { ValidationError } from '../../types';

/**
 * Validates basic JavaScript types (string, number, boolean, array).
 *
 * Provides foundational type checking before AppSheet-specific validation.
 *
 * @category Validation
 */
export class BaseTypeValidator {
  /**
   * Validate that value is a string
   */
  static validateString(
    fieldName: string,
    fieldType: string,
    value: any,
    rowIndex: number
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== 'string') {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a string (${fieldType}), got ${actualType}`,
        { fieldName, expectedType: fieldType, actualType, value }
      );
    }
  }

  /**
   * Validate that value is a number
   */
  static validateNumber(
    fieldName: string,
    fieldType: string,
    value: any,
    rowIndex: number
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== 'number') {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a number (${fieldType}), got ${actualType}`,
        { fieldName, expectedType: fieldType, actualType, value }
      );
    }
  }

  /**
   * Validate that value is a boolean or "Yes"/"No" string
   */
  static validateBoolean(fieldName: string, value: any, rowIndex: number): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== 'boolean' && value !== 'Yes' && value !== 'No') {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be a boolean or "Yes"/"No" string, got ${actualType}`,
        { fieldName, expectedType: 'boolean', actualType, value }
      );
    }
  }

  /**
   * Validate that value is an array
   */
  static validateArray(
    fieldName: string,
    fieldType: string,
    value: any,
    rowIndex: number
  ): void {
    if (!Array.isArray(value)) {
      const actualType = typeof value;
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be an array (${fieldType}), got ${actualType}`,
        { fieldName, expectedType: fieldType, actualType, value }
      );
    }
  }

  /**
   * Validate that value is a Date object or valid date string
   */
  static validateDateValue(fieldName: string, value: any, rowIndex: number): boolean {
    if (value instanceof Date) {
      return true;
    }
    if (typeof value === 'string') {
      return true; // Let format validator check the format
    }
    throw new ValidationError(
      `Row ${rowIndex}: Field "${fieldName}" must be a date string or Date object`,
      { fieldName, value }
    );
  }
}
