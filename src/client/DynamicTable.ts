/**
 * Dynamic table client with runtime schema validation
 * @module client
 * @category Client
 */

import { AppSheetClient } from './AppSheetClient';
import { TableDefinition, ValidationError } from '../types';

/**
 * Table client with schema-based operations and runtime validation.
 *
 * Provides CRUD operations for a specific table with automatic validation
 * based on the table's schema definition. Validates field types, required
 * fields, and enum values at runtime.
 *
 * @template T - The TypeScript type for rows in this table
 * @category Client
 *
 * @example
 * ```typescript
 * // Usually created via SchemaManager
 * const table = db.table<Worklog>('worklog', 'worklogs');
 *
 * // CRUD operations with validation
 * const all = await table.findAll();
 * const filtered = await table.find('[date] = "2025-10-27"');
 * await table.add([{ id: '1', date: '2025-10-27', hours: 8 }]);
 * await table.update([{ id: '1', hours: 7 }]);
 * await table.delete([{ id: '1' }]);
 * ```
 */
export class DynamicTable<T = Record<string, any>> {
  constructor(
    private client: AppSheetClient,
    private definition: TableDefinition
  ) {}

  /**
   * Find all rows in the table
   */
  async findAll(): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
    });
    return result.rows;
  }

  /**
   * Find one row by selector
   */
  async findOne(selector: string): Promise<T | null> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows[0] || null;
  }

  /**
   * Find rows with optional selector
   */
  async find(selector?: string): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows;
  }

  /**
   * Add rows to the table
   */
  async add(rows: Partial<T>[]): Promise<T[]> {
    // Validate rows
    this.validateRows(rows);

    const result = await this.client.add<T>({
      tableName: this.definition.tableName,
      rows: rows as T[],
    });
    return result.rows;
  }

  /**
   * Update rows in the table
   */
  async update(rows: Partial<T>[]): Promise<T[]> {
    // Validate rows
    this.validateRows(rows, false);

    const result = await this.client.update<T>({
      tableName: this.definition.tableName,
      rows: rows as T[],
    });
    return result.rows;
  }

  /**
   * Delete rows from the table
   */
  async delete(keys: Partial<T>[]): Promise<boolean> {
    await this.client.delete({
      tableName: this.definition.tableName,
      rows: keys,
    });
    return true;
  }

  /**
   * Get the table definition
   */
  getDefinition(): TableDefinition {
    return this.definition;
  }

  /**
   * Get the table name
   */
  getTableName(): string {
    return this.definition.tableName;
  }

  /**
   * Get the key field name
   */
  getKeyField(): string {
    return this.definition.keyField;
  }

  /**
   * Validate rows based on schema
   */
  private validateRows(rows: Partial<T>[], checkRequired = true): void {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
        const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
        const isRequired = typeof fieldDef === 'object' && fieldDef.required;
        const value = (row as any)[fieldName];

        // Check required fields (only for add operations)
        if (checkRequired && isRequired && (value === undefined || value === null)) {
          throw new ValidationError(
            `Row ${i}: Field "${fieldName}" is required in table "${this.definition.tableName}"`,
            { row, fieldName }
          );
        }

        // Skip validation if value is not provided
        if (value === undefined || value === null) {
          continue;
        }

        // Type validation
        this.validateFieldType(i, fieldName, fieldType, value);

        // Enum validation
        if (typeof fieldDef === 'object' && fieldDef.enum) {
          this.validateEnum(i, fieldName, fieldDef.enum, value);
        }
      }
    }
  }

  /**
   * Validate field type
   */
  private validateFieldType(
    rowIndex: number,
    fieldName: string,
    expectedType: string,
    value: any
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    switch (expectedType) {
      case 'number':
        if (actualType !== 'number') {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be a number, got ${actualType}`,
            { fieldName, expectedType, actualType, value }
          );
        }
        break;

      case 'boolean':
        if (actualType !== 'boolean') {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be a boolean, got ${actualType}`,
            { fieldName, expectedType, actualType, value }
          );
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be an array, got ${actualType}`,
            { fieldName, expectedType, actualType, value }
          );
        }
        break;

      case 'object':
        if (actualType !== 'object' || Array.isArray(value)) {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be an object, got ${actualType}`,
            { fieldName, expectedType, actualType, value }
          );
        }
        break;

      case 'date':
        // Accept string, Date object, or ISO date format
        if (actualType === 'string') {
          // Basic ISO date check
          if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
            throw new ValidationError(
              `Row ${rowIndex}: Field "${fieldName}" must be a valid date string (YYYY-MM-DD...)`,
              { fieldName, value }
            );
          }
        } else if (!(value instanceof Date)) {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be a date string or Date object`,
            { fieldName, value }
          );
        }
        break;

      case 'string':
        if (actualType !== 'string') {
          throw new ValidationError(
            `Row ${rowIndex}: Field "${fieldName}" must be a string, got ${actualType}`,
            { fieldName, expectedType, actualType, value }
          );
        }
        break;
    }
  }

  /**
   * Validate enum value
   */
  private validateEnum(
    rowIndex: number,
    fieldName: string,
    allowedValues: string[],
    value: any
  ): void {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `Row ${rowIndex}: Field "${fieldName}" must be one of: ${allowedValues.join(', ')}. Got: ${value}`,
        { fieldName, allowedValues, value }
      );
    }
  }
}
