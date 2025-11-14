/**
 * Schema inspector for automatically discovering table structures
 * @module cli
 * @category CLI
 */

import * as readline from 'readline';
import { AppSheetClient } from '../client';
import { TableInspectionResult, ConnectionDefinition, TableDefinition } from '../types';

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
      // Fetch some rows to infer field types
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

      // Analyze first row for field types
      const sampleRow = result.rows[0];
      const fields: Record<string, string> = {};

      for (const [key, value] of Object.entries(sampleRow)) {
        fields[key] = this.inferType(value);
      }

      return {
        tableName,
        keyField: this.guessKeyField(sampleRow),
        fields,
      };
    } catch (error: any) {
      throw new Error(`Failed to inspect table "${tableName}": ${error.message}`);
    }
  }

  /**
   * Infer field type from value
   */
  private inferType(value: any): string {
    if (value === null || value === undefined) {
      return 'string'; // Default
    }

    const type = typeof value;

    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (type === 'object') return 'object';

    // Check if string looks like a date
    if (type === 'string') {
      // ISO date format
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return 'date';
      }
    }

    return 'string';
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
