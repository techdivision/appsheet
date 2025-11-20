/**
 * Schema inspector for automatically discovering table structures
 * @module cli
 * @category CLI
 */

import * as readline from 'readline';
import { AppSheetClient } from '../client';
import {
  TableInspectionResult,
  ConnectionDefinition,
  TableDefinition,
  AppSheetFieldType,
  FieldDefinition,
} from '../types';

/**
 * Inspects AppSheet tables and generates schema definitions.
 *
 * Automatically discovers table structures by fetching sample data and
 * inferring field types, key fields, and generating schema definitions.
 * Used by the CLI tool for schema generation.
 *
 * @category CLI
 *
 * @example
 * ```typescript
 * const client = new AppSheetClient({ appId, applicationAccessKey });
 * const inspector = new SchemaInspector(client);
 *
 * // Inspect a single table
 * const result = await inspector.inspectTable('extract_worklog');
 * console.log('Fields:', result.fields);
 * console.log('Key field:', result.keyField);
 * ```
 */
export class SchemaInspector {
  constructor(private client: AppSheetClient) {}

  /**
   * Inspect a specific table and infer its schema.
   *
   * Fetches sample data from the table and analyzes it to determine:
   * - Field names and types (string, number, boolean, date, array, object)
   * - Primary key field (looks for id, key, ID, Key, _RowNumber)
   * - Field structure
   *
   * @param tableName - The name of the AppSheet table to inspect
   * @returns Promise resolving to table inspection result with inferred schema
   * @throws {Error} If the table cannot be accessed or inspected
   *
   * @example
   * ```typescript
   * const result = await inspector.inspectTable('extract_worklog');
   * if (result.warning) {
   *   console.warn('Warning:', result.warning);
   * }
   * console.log('Discovered fields:', Object.keys(result.fields));
   * ```
   */
  async inspectTable(tableName: string): Promise<TableInspectionResult> {
    try {
      // Fetch rows to infer field types (limit to 100 for performance)
      const result = await this.client.find({
        tableName,
        // No selector = get all rows
      });

      if (!result.rows || result.rows.length === 0) {
        return {
          tableName,
          keyField: 'id', // Default
          fields: {},
          warning: 'Table is empty, could not infer field types',
        };
      }

      // Analyze all rows (or sample if too many)
      const sampleRows = result.rows.slice(0, 100);
      const fields: Record<string, FieldDefinition> = {};

      // Get all field names from first row
      const fieldNames = Object.keys(sampleRows[0]);

      for (const fieldName of fieldNames) {
        // Collect all values for this field
        const values = sampleRows.map((row) => row[fieldName]).filter((v) => v !== null && v !== undefined);

        if (values.length === 0) {
          // No non-null values found
          fields[fieldName] = {
            type: 'Text',
            required: false,
          };
          continue;
        }

        // Infer type from first non-null value
        let inferredType = this.inferType(values[0]);

        // Check if Text field might actually be an Enum based on unique values
        if (inferredType === 'Text' && this.looksLikeEnum(values)) {
          inferredType = 'Enum';
        }

        // Build field definition
        const fieldDef: FieldDefinition = {
          type: inferredType,
          required: false, // Cannot determine from data alone
        };

        // Extract allowedValues for Enum/EnumList
        if (inferredType === 'Enum' || inferredType === 'EnumList') {
          fieldDef.allowedValues = this.extractAllowedValues(values, inferredType);
        }

        fields[fieldName] = fieldDef;
      }

      return {
        tableName,
        keyField: this.guessKeyField(sampleRows[0]),
        fields,
      };
    } catch (error: any) {
      throw new Error(`Failed to inspect table "${tableName}": ${error.message}`);
    }
  }

  /**
   * Infer AppSheet field type from value with improved heuristics
   */
  private inferType(value: any): AppSheetFieldType {
    if (value === null || value === undefined) {
      return 'Text'; // Default
    }

    const type = typeof value;

    // Number types
    if (type === 'number') {
      // Check if it looks like a percent (0.00 to 1.00, excluding exact 0 and 1)
      if (value > 0 && value < 1) {
        return 'Percent';
      }
      // Default to Number for all numeric values
      return 'Number';
    }

    // Boolean or "Yes"/"No" strings
    if (type === 'boolean' || value === 'Yes' || value === 'No') {
      return 'YesNo';
    }

    // Arrays - could be EnumList
    if (Array.isArray(value)) {
      return 'EnumList';
    }

    // String pattern detection (order matters - most specific first)
    if (type === 'string') {
      // DateTime pattern (ISO 8601 with time) - check before Date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        return 'DateTime';
      }

      // Date pattern (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return 'Date';
      }

      // Email pattern
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Email';
      }

      // URL pattern (http/https)
      if (/^https?:\/\//i.test(value)) {
        return 'URL';
      }

      // Phone pattern - more restrictive to avoid false positives
      // Must have at least 7 digits, may contain spaces, +, -, (, )
      if (/^[\d\s+\-()]{10,}$/.test(value) && /\d{7,}/.test(value.replace(/[\s+\-()]/g, ''))) {
        return 'Phone';
      }

      // If string has very few unique values across dataset, it might be an Enum
      // (This will be determined by caller based on analyzing multiple rows)
    }

    // Default to Text for strings and unknown types
    return 'Text';
  }

  /**
   * Check if a text field looks like an Enum based on unique values
   *
   * Heuristic: If there are relatively few unique values compared to total values,
   * it's likely an enum field (e.g., status, category, priority).
   */
  private looksLikeEnum(values: any[]): boolean {
    // Only consider string values
    const stringValues = values.filter((v) => typeof v === 'string');
    if (stringValues.length === 0) {
      return false;
    }

    // Get unique values
    const uniqueValues = new Set(stringValues);

    // Heuristics:
    // 1. If less than 10 unique values total, likely an enum
    // 2. If unique values are less than 20% of total values, likely an enum
    // 3. Must have at least 2 samples
    if (stringValues.length < 2) {
      return false;
    }

    if (uniqueValues.size <= 10) {
      return true;
    }

    const uniqueRatio = uniqueValues.size / stringValues.length;
    return uniqueRatio < 0.2;
  }

  /**
   * Extract allowed values for Enum/EnumList fields
   */
  private extractAllowedValues(values: any[], fieldType: AppSheetFieldType): string[] {
    const uniqueValues = new Set<string>();

    for (const value of values) {
      if (fieldType === 'EnumList' && Array.isArray(value)) {
        // For EnumList, collect all values from all arrays
        value.forEach((v) => {
          if (typeof v === 'string') {
            uniqueValues.add(v);
          }
        });
      } else if (fieldType === 'Enum' && typeof value === 'string') {
        // For Enum, collect unique string values
        uniqueValues.add(value);
      }
    }

    return Array.from(uniqueValues).sort();
  }

  /**
   * Guess the key field from row data
   */
  private guessKeyField(row: Record<string, any>): string {
    // Common key field names
    const commonKeys = ['id', 'key', 'ID', 'Key', '_RowNumber', 'Id'];

    for (const key of commonKeys) {
      if (key in row) {
        return key;
      }
    }

    // Fallback: first field
    return Object.keys(row)[0] || 'id';
  }

  /**
   * Generate schema for multiple tables
   */
  async generateSchema(
    _connectionName: string,
    tableNames: string[]
  ): Promise<ConnectionDefinition> {
    const tables: Record<string, TableDefinition> = {};

    for (const tableName of tableNames) {
      console.log(`Inspecting table: ${tableName}...`);
      const inspection = await this.inspectTable(tableName);

      tables[this.toSchemaName(tableName)] = {
        tableName: inspection.tableName,
        keyField: inspection.keyField,
        fields: inspection.fields,
      };

      if (inspection.warning) {
        console.warn(`  Warning: ${inspection.warning}`);
      }
    }

    return {
      appId: '${APPSHEET_APP_ID}', // Placeholder
      applicationAccessKey: '${APPSHEET_ACCESS_KEY}', // Placeholder
      tables,
    };
  }

  /**
   * Convert table name to schema-friendly name
   * Examples:
   * - "extract_user" -> "users"
   * - "worklog" -> "worklogs"
   */
  toSchemaName(tableName: string): string {
    return tableName
      .replace(/^extract_/, '')
      .replace(/_/g, '')
      .toLowerCase() + 's';
  }

  /**
   * Attempt to discover all tables (limited support)
   */
  async discoverTables(): Promise<string[]> {
    // Note: AppSheet API doesn't have a direct "list tables" endpoint
    // This is a placeholder for potential strategies

    try {
      // Strategy 1: Try system table (if exists)
      try {
        const result = await this.client.find({
          tableName: '_table_info',
        });

        if (result.rows && result.rows.length > 0) {
          return result.rows.map((row: any) => row.tableName || row.name);
        }
      } catch {
        // Continue to next strategy
      }

      // Strategy 2: Parse error message (try non-existent table)
      try {
        await this.client.find({
          tableName: '_nonexistent_table_xyz_123',
        });
      } catch (error: any) {
        const errorMsg = error.message || error.toString();

        // Look for table list in error message
        const match = errorMsg.match(/available tables?:?\s*([^\n]+)/i);
        if (match) {
          const tableList = match[1];
          return tableList
            .split(/[,;]/)
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0);
        }
      }

      return [];
    } catch (error) {
      console.error('Failed to discover tables:', error);
      return [];
    }
  }

  /**
   * Interactive prompt for table names
   */
  async promptForTables(): Promise<string[]> {
    console.log('\nAutomatic table discovery is not available.');
    console.log('Please enter table names manually.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Enter table names (comma-separated): ', (answer: string) => {
        rl.close();
        const tables = answer
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        resolve(tables);
      });
    });
  }
}
