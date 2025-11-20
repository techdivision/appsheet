/**
 * AppSheet-specific type validation
 * @module utils
 * @category Validation
 */

import { AppSheetFieldType, ValidationError } from '../../types';
import { BaseTypeValidator } from './BaseTypeValidator';
import { FormatValidator } from './FormatValidator';

/**
 * Validates AppSheet field types with format and constraint checking.
 *
 * Combines base type validation with AppSheet-specific format validation
 * for all supported field types.
 *
 * @category Validation
 */
export class AppSheetTypeValidator {
  /**
   * Validate a field value against its AppSheet field type
   */
  static validate(
    fieldName: string,
    fieldType: AppSheetFieldType,
    value: any,
    rowIndex: number
  ): void {
    switch (fieldType) {
      // Core numeric types
      case 'Number':
      case 'Decimal':
      case 'Price':
      case 'ChangeCounter':
        BaseTypeValidator.validateNumber(fieldName, fieldType, value, rowIndex);
        break;

      // Percent: number with range validation
      case 'Percent':
        BaseTypeValidator.validateNumber(fieldName, fieldType, value, rowIndex);
        FormatValidator.validatePercentRange(fieldName, value, rowIndex);
        break;

      // Boolean type
      case 'YesNo':
        BaseTypeValidator.validateBoolean(fieldName, value, rowIndex);
        break;

      // Array types
      case 'EnumList':
      case 'RefList':
        BaseTypeValidator.validateArray(fieldName, fieldType, value, rowIndex);
        break;

      // Date types
      case 'Date':
        if (BaseTypeValidator.validateDateValue(fieldName, value, rowIndex)) {
          if (typeof value === 'string') {
            FormatValidator.validateDateFormat(fieldName, value, rowIndex);
          }
        }
        break;

      case 'DateTime':
      case 'ChangeTimestamp':
        if (BaseTypeValidator.validateDateValue(fieldName, value, rowIndex)) {
          if (typeof value === 'string') {
            FormatValidator.validateDateTimeFormat(fieldName, value, rowIndex);
          }
        }
        break;

      // Time and Duration (string format)
      case 'Time':
      case 'Duration':
        BaseTypeValidator.validateString(fieldName, fieldType, value, rowIndex);
        break;

      // Email with format validation
      case 'Email':
        BaseTypeValidator.validateString(fieldName, fieldType, value, rowIndex);
        FormatValidator.validateEmail(fieldName, value, rowIndex);
        break;

      // URL with format validation
      case 'URL':
        BaseTypeValidator.validateString(fieldName, fieldType, value, rowIndex);
        FormatValidator.validateURL(fieldName, value, rowIndex);
        break;

      // Phone with format validation
      case 'Phone':
        BaseTypeValidator.validateString(fieldName, fieldType, value, rowIndex);
        FormatValidator.validatePhone(fieldName, value, rowIndex);
        break;

      // Text-based types (no additional validation)
      case 'Text':
      case 'Name':
      case 'Address':
      case 'Color':
      case 'Enum':
      case 'Ref':
      case 'Image':
      case 'File':
      case 'Drawing':
      case 'Signature':
      case 'ChangeLocation':
      case 'Show':
        BaseTypeValidator.validateString(fieldName, fieldType, value, rowIndex);
        break;

      default:
        // Unknown type - skip validation
        break;
    }
  }

  /**
   * Validate enum value against allowed values
   */
  static validateEnum(
    fieldName: string,
    fieldType: AppSheetFieldType,
    allowedValues: string[],
    value: any,
    rowIndex: number
  ): void {
    if (fieldType === 'EnumList') {
      // EnumList: validate array of values
      if (!Array.isArray(value)) {
        throw new ValidationError(
          `Row ${rowIndex}: Field "${fieldName}" must be an array for EnumList type`,
          { fieldName, value }
        );
      }
      const invalidValues = value.filter((v) => !allowedValues.includes(v));
      if (invalidValues.length > 0) {
        throw new ValidationError(
          `Row ${rowIndex}: Field "${fieldName}" contains invalid values: ${invalidValues.join(', ')}. Allowed: ${allowedValues.join(', ')}`,
          { fieldName, allowedValues, invalidValues }
        );
      }
    } else {
      // Enum: validate single value
      if (!allowedValues.includes(value)) {
        throw new ValidationError(
          `Row ${rowIndex}: Field "${fieldName}" must be one of: ${allowedValues.join(', ')}. Got: ${value}`,
          { fieldName, allowedValues, value }
        );
      }
    }
  }

  /**
   * Validate required field
   */
  static validateRequired(
    fieldName: string,
    tableName: string,
    value: any,
    row: any,
    rowIndex: number
  ): void {
    if (value === undefined || value === null) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" is required in table "${tableName}"`,
        { row, fieldName }
      );
    }
  }
}
