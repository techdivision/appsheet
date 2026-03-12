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
 * Result of locale detection from date values.
 * @internal
 */
interface LocaleDetectionResult {
  /** Detected locale (BCP 47) or undefined if detection not possible */
  locale?: string;
  /** Whether the detection was ambiguous (all date parts <= 12) */
  ambiguous: boolean;
}

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
  /** Locale mapping: partOrder + separator → representative locale */
  private static readonly LOCALE_MAP: Record<string, string> = {
    'day,month,year:.': 'de-DE',
    'day,month,year:/': 'en-GB',
    'month,day,year:/': 'en-US',
    'year,month,day:/': 'ja-JP',
  };

  /** Default locales for ambiguous cases, keyed by separator */
  private static readonly DEFAULT_LOCALE: Record<string, string> = {
    '/': 'en-US',
    '.': 'de-DE',
  };

  /** Pattern matching locale-formatted dates: DD.MM.YYYY, MM/DD/YYYY, YYYY/MM/DD etc. */
  private static readonly LOCALE_DATE_PATTERN = /^\d{1,4}[./]\d{1,2}[./]\d{1,4}$/;

  /** Pattern matching locale-formatted datetimes: date part + space + time part */
  private static readonly LOCALE_DATETIME_PATTERN =
    /^\d{1,4}[./]\d{1,2}[./]\d{1,4}\s+\d{1,2}:\d{2}/;

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
        const values = sampleRows
          .map((row) => row[fieldName])
          .filter((v) => v !== null && v !== undefined);

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

      // Detect locale from date field values
      const { locale, ambiguous } = this.detectLocale(sampleRows, fields);

      let warning: string | undefined;
      if (ambiguous && locale) {
        warning = `Locale detection ambiguous, defaulting to "${locale}". Please verify.`;
      }

      return {
        tableName,
        keyField: this.guessKeyField(sampleRows[0]),
        fields,
        locale,
        warning,
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

      // Locale-formatted DateTime (e.g. "25.03.2026 14:30:00", "03/25/2026 2:30 PM")
      if (SchemaInspector.LOCALE_DATETIME_PATTERN.test(value)) {
        return 'DateTime';
      }

      // Locale-formatted Date (e.g. "25.03.2026", "03/25/2026", "2026/03/25")
      if (SchemaInspector.LOCALE_DATE_PATTERN.test(value)) {
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
   * Detect locale from date values in sample rows.
   *
   * Analyzes Date/DateTime/ChangeTimestamp field values to determine the locale
   * of the AppSheet app by examining separator and part order.
   *
   * @param rows - Sample rows from AppSheet API
   * @param fields - Already-inferred field definitions
   * @returns Detected locale or undefined if detection not possible
   */
  private detectLocale(
    rows: Record<string, any>[],
    fields: Record<string, FieldDefinition>
  ): LocaleDetectionResult {
    // 1. Collect date field names
    const dateFieldNames = Object.entries(fields)
      .filter(([, def]) => ['Date', 'DateTime', 'ChangeTimestamp'].includes(def.type))
      .map(([name]) => name);

    if (dateFieldNames.length === 0) {
      return { locale: undefined, ambiguous: false };
    }

    // 2. Collect non-ISO date strings (extract date part from DateTime values)
    const dateStrings: string[] = [];
    for (const row of rows) {
      for (const fieldName of dateFieldNames) {
        const value = row[fieldName];
        if (typeof value !== 'string') continue;
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) continue; // Skip ISO

        // For DateTime, extract date part only (before space)
        const spaceIdx = value.indexOf(' ');
        const datePart = spaceIdx > 0 ? value.substring(0, spaceIdx) : value;
        dateStrings.push(datePart);
      }
    }

    if (dateStrings.length === 0) {
      return { locale: undefined, ambiguous: false };
    }

    // 3. Detect separator from first value
    const separator = dateStrings[0].match(/[^0-9]/)?.[0];
    if (!separator) {
      return { locale: undefined, ambiguous: false };
    }

    // 4. Determine part order
    const parts = dateStrings[0].split(separator);
    if (parts.length !== 3) {
      return { locale: undefined, ambiguous: false };
    }

    // Year position (4-digit part)
    const yearPos = parts.findIndex((p) => p.length === 4);
    if (yearPos === 0) {
      // YMD (e.g. ja-JP: "2026/03/12")
      const key = `year,month,day:${separator}`;
      const locale = SchemaInspector.LOCALE_MAP[key];
      return { locale, ambiguous: false };
    }

    if (yearPos !== 2) {
      return { locale: undefined, ambiguous: false };
    }

    // Year at position 2 → DMY or MDY
    // Check all date values for disambiguation
    let foundFirstPartGt12 = false;
    let foundSecondPartGt12 = false;

    for (const dateStr of dateStrings) {
      const p = dateStr.split(separator);
      if (p.length !== 3) continue;
      const first = parseInt(p[0], 10);
      const second = parseInt(p[1], 10);
      if (first > 12) foundFirstPartGt12 = true;
      if (second > 12) foundSecondPartGt12 = true;
    }

    if (foundFirstPartGt12 && !foundSecondPartGt12) {
      // First part is day → DMY
      const key = `day,month,year:${separator}`;
      const locale = SchemaInspector.LOCALE_MAP[key];
      return { locale, ambiguous: false };
    }

    if (foundSecondPartGt12 && !foundFirstPartGt12) {
      // Second part is day → MDY
      const key = `month,day,year:${separator}`;
      const locale = SchemaInspector.LOCALE_MAP[key];
      return { locale, ambiguous: false };
    }

    // Ambiguous: no part > 12, or both > 12 (shouldn't happen with valid dates)
    const defaultLocale = SchemaInspector.DEFAULT_LOCALE[separator] || 'en-US';
    return { locale: defaultLocale, ambiguous: true };
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
    const detectedLocales: string[] = [];

    for (const tableName of tableNames) {
      console.log(`Inspecting table: ${tableName}...`);
      const inspection = await this.inspectTable(tableName);

      const tableDef: TableDefinition = {
        tableName: inspection.tableName,
        keyField: inspection.keyField,
        fields: inspection.fields,
      };

      // Set locale on table level if detected
      if (inspection.locale) {
        tableDef.locale = inspection.locale;
        detectedLocales.push(inspection.locale);
      }

      tables[this.toSchemaName(tableName)] = tableDef;

      if (inspection.warning) {
        console.warn(`  Warning: ${inspection.warning}`);
      }
    }

    // Connection-level locale = most frequent detected locale
    const connectionLocale = this.mostFrequent(detectedLocales);

    const connectionDef: ConnectionDefinition = {
      appId: '${APPSHEET_APP_ID}', // Placeholder
      applicationAccessKey: '${APPSHEET_ACCESS_KEY}', // Placeholder
      tables,
    };

    if (connectionLocale) {
      connectionDef.locale = connectionLocale;
    }

    return connectionDef;
  }

  /**
   * Returns the most frequent string in an array, or undefined if empty.
   * @internal
   */
  private mostFrequent(values: string[]): string | undefined {
    if (values.length === 0) return undefined;
    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = values[0];
    let bestCount = 0;
    for (const [v, c] of counts) {
      if (c > bestCount) {
        best = v;
        bestCount = c;
      }
    }
    return best;
  }

  /**
   * Convert table name to schema-friendly name
   * Examples:
   * - "extract_user" -> "users"
   * - "worklog" -> "worklogs"
   */
  toSchemaName(tableName: string): string {
    return (
      tableName
        .replace(/^extract_/, '')
        .replace(/_/g, '')
        .toLowerCase() + 's'
    );
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
