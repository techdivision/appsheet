/**
 * Dynamic table client with runtime schema validation
 * @module client
 * @category Client
 */

import { AppSheetClientInterface, TableDefinition, UnknownFieldPolicyInterface } from '../types';
import { AppSheetTypeValidator } from '../utils/validators';
import { StripUnknownFieldPolicy } from '../utils/policies';

/**
 * Table client with schema-based operations and runtime validation.
 *
 * Provides CRUD operations for a specific table with automatic validation
 * based on the table's schema definition. Validates field types, required
 * fields, and enum values at runtime.
 *
 * In v3.0.0, accepts AppSheetClientInterface instead of concrete AppSheetClient,
 * enabling dependency injection and use with MockAppSheetClient for testing.
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
export class DynamicTable<T extends Record<string, any> = Record<string, any>> {
  private readonly unknownFieldPolicy: UnknownFieldPolicyInterface;

  /**
   * Creates a new DynamicTable instance.
   *
   * @param client - AppSheet client for API operations
   * @param definition - Table schema definition
   * @param unknownFieldPolicy - Optional policy for handling unknown fields (default: StripUnknownFieldPolicy)
   */
  constructor(
    private client: AppSheetClientInterface,
    private definition: TableDefinition,
    unknownFieldPolicy?: UnknownFieldPolicyInterface
  ) {
    this.unknownFieldPolicy = unknownFieldPolicy ?? new StripUnknownFieldPolicy();
  }

  /**
   * Find all rows in the table.
   *
   * Retrieves all rows from the table without filtering.
   * Uses the schema-configured table name automatically.
   *
   * @returns Promise resolving to array of all rows
   *
   * @example
   * ```typescript
   * const table = db.table<Worklog>('worklog', 'worklogs');
   * const allRecords = await table.findAll();
   * console.log(`Found ${allRecords.length} records`);
   * ```
   */
  async findAll(): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
    });
    return result.rows;
  }

  /**
   * Find a single row by selector.
   *
   * Executes a query with the given selector and returns the first matching row.
   * Returns null if no rows match the selector.
   *
   * @param selector - AppSheet selector expression (e.g., "[Email] = 'user@example.com'")
   * @returns Promise resolving to the first matching row or null
   *
   * @example
   * ```typescript
   * const user = await table.findOne('[Email] = "john@example.com"');
   * if (user) {
   *   console.log('Found user:', user.name);
   * }
   * ```
   */
  async findOne(selector: string): Promise<T | null> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows[0] || null;
  }

  /**
   * Find rows with optional filtering.
   *
   * Retrieves rows from the table, optionally filtered by a selector expression.
   * If no selector is provided, returns all rows (equivalent to findAll).
   *
   * @param selector - Optional AppSheet selector expression for filtering
   * @returns Promise resolving to array of matching rows
   *
   * @example
   * ```typescript
   * // Find all active users
   * const active = await table.find('[Status] = "Active"');
   *
   * // Find users created this month
   * const recent = await table.find('[CreatedDate] >= "2025-10-01"');
   *
   * // Find all (no filter)
   * const all = await table.find();
   * ```
   */
  async find(selector?: string): Promise<T[]> {
    const result = await this.client.find<T>({
      tableName: this.definition.tableName,
      selector,
    });
    return result.rows;
  }

  /**
   * Add rows to the table.
   *
   * Creates new rows in the table with runtime validation based on the schema.
   * Validates field types, required fields, and enum values before sending to API.
   *
   * @param rows - Array of row objects to add (partial rows allowed, server may generate fields)
   * @returns Promise resolving to array of created rows with server-generated fields
   * @throws {ValidationError} If validation fails (type mismatch, missing required fields, invalid enum values)
   *
   * @example
   * ```typescript
   * interface Worklog {
   *   id: string;
   *   date: string;
   *   hours: number;
   *   description: string;
   * }
   *
   * const table = db.table<Worklog>('worklog', 'worklogs');
   *
   * const created = await table.add([
   *   { id: '1', date: '2025-10-29', hours: 8, description: 'Development' },
   *   { id: '2', date: '2025-10-29', hours: 4, description: 'Meeting' }
   * ]);
   *
   * console.log('Created records:', created);
   * ```
   */
  async add(rows: Partial<T>[]): Promise<T[]> {
    // Apply unknown field policy before validation
    const knownFields = Object.keys(this.definition.fields);
    const processedRows = this.unknownFieldPolicy.apply<T>(
      this.definition.tableName,
      rows,
      knownFields
    );

    // Validate rows
    this.validateRows(processedRows);

    const result = await this.client.add<T>({
      tableName: this.definition.tableName,
      rows: processedRows as T[],
      properties: this.definition.locale ? { Locale: this.definition.locale } : undefined,
    });
    return result.rows;
  }

  /**
   * Update rows in the table.
   *
   * Updates existing rows with runtime validation. Rows must include the key field
   * to identify which row to update. Only validates provided fields (partial updates allowed).
   *
   * @param rows - Array of partial row objects to update (must include key field)
   * @returns Promise resolving to array of updated rows
   * @throws {ValidationError} If validation fails (type mismatch, invalid enum values)
   *
   * @example
   * ```typescript
   * // Update single field
   * await table.update([
   *   { id: '1', hours: 7 }  // Only update hours field
   * ]);
   *
   * // Update multiple rows and fields
   * await table.update([
   *   { id: '1', hours: 7, description: 'Updated desc' },
   *   { id: '2', status: 'Completed' }
   * ]);
   * ```
   */
  async update(rows: Partial<T>[]): Promise<T[]> {
    // Apply unknown field policy before validation
    const knownFields = Object.keys(this.definition.fields);
    const processedRows = this.unknownFieldPolicy.apply<T>(
      this.definition.tableName,
      rows,
      knownFields
    );

    // Validate rows
    this.validateRows(processedRows, false);

    const result = await this.client.update<T>({
      tableName: this.definition.tableName,
      rows: processedRows as T[],
      properties: this.definition.locale ? { Locale: this.definition.locale } : undefined,
    });
    return result.rows;
  }

  /**
   * Delete rows from the table.
   *
   * Deletes rows identified by their key field. Only the key field is required
   * in the row objects.
   *
   * @param keys - Array of row objects containing at least the key field
   * @returns Promise resolving to true if deletion succeeded
   *
   * @example
   * ```typescript
   * // Delete by key field
   * await table.delete([
   *   { id: '1' },
   *   { id: '2' }
   * ]);
   *
   * // Full objects work too (only key field is used)
   * await table.delete([
   *   { id: '3', date: '2025-10-29', hours: 8, description: 'Old' }
   * ]);
   * ```
   */
  async delete(keys: Partial<T>[]): Promise<boolean> {
    // Apply unknown field policy to delete keys too
    const knownFields = Object.keys(this.definition.fields);
    const processedKeys = this.unknownFieldPolicy.apply<T>(
      this.definition.tableName,
      keys,
      knownFields
    );

    await this.client.delete({
      tableName: this.definition.tableName,
      rows: processedKeys,
    });
    return true;
  }

  /**
   * Get the table definition.
   *
   * Returns the complete table definition including table name, key field,
   * and field schema with types and validation rules.
   *
   * @returns The TableDefinition object
   *
   * @example
   * ```typescript
   * const def = table.getDefinition();
   * console.log('Table name:', def.tableName);
   * console.log('Key field:', def.keyField);
   * console.log('Fields:', Object.keys(def.fields));
   * ```
   */
  getDefinition(): TableDefinition {
    return this.definition;
  }

  /**
   * Get the AppSheet table name.
   *
   * Returns the actual table name used in AppSheet API calls.
   * This may differ from the schema name used in your code.
   *
   * @returns The AppSheet table name
   *
   * @example
   * ```typescript
   * const tableName = table.getTableName();
   * console.log('AppSheet table name:', tableName);
   * // Output: "extract_worklog" (actual AppSheet table name)
   * ```
   */
  getTableName(): string {
    return this.definition.tableName;
  }

  /**
   * Get the key field name.
   *
   * Returns the name of the primary key field used to identify rows
   * in update and delete operations.
   *
   * @returns The key field name
   *
   * @example
   * ```typescript
   * const keyField = table.getKeyField();
   * console.log('Primary key:', keyField);
   * // Output: "id"
   *
   * // Use key field for updates
   * await table.update([{ [keyField]: '123', status: 'Done' }]);
   * ```
   */
  getKeyField(): string {
    return this.definition.keyField;
  }

  /**
   * Validate rows based on schema using AppSheetTypeValidator
   */
  private validateRows(rows: Partial<T>[], checkRequired = true): void {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      for (const [fieldName, fieldDef] of Object.entries(this.definition.fields)) {
        const fieldType = fieldDef.type;
        const isRequired = fieldDef.required === true;
        const value = (row as any)[fieldName];

        // Check required fields (only for add operations)
        if (checkRequired && isRequired) {
          AppSheetTypeValidator.validateRequired(
            fieldName,
            this.definition.tableName,
            value,
            row,
            i
          );
        }

        // Skip validation if value is not provided
        if (value === undefined || value === null) {
          continue;
        }

        // Type validation using AppSheetTypeValidator (with locale for date/datetime)
        AppSheetTypeValidator.validate(fieldName, fieldType, value, i, this.definition.locale);

        // Enum/EnumList validation
        if (fieldDef.allowedValues) {
          AppSheetTypeValidator.validateEnum(
            fieldName,
            fieldType,
            fieldDef.allowedValues,
            value,
            i
          );
        }
      }
    }
  }
}
