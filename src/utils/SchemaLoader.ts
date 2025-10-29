/**
 * Schema loader for loading table schemas from JSON/YAML files
 * @module utils
 * @category Schema Management
 */

import * as fs from 'fs';
import * as yaml from 'yaml';
import { SchemaConfig, SchemaValidationResult } from '../types';

/**
 * Loads and validates schema configurations from files or objects.
 *
 * Supports loading schemas from YAML or JSON files with environment
 * variable substitution (${VAR_NAME} syntax).
 *
 * @category Schema Management
 *
 * @example
 * ```typescript
 * // Load from YAML
 * const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
 *
 * // Load from JSON
 * const schema = SchemaLoader.fromJson('./config/appsheet-schema.json');
 *
 * // Validate schema
 * const validation = SchemaLoader.validate(schema);
 * if (!validation.valid) {
 *   console.error('Schema errors:', validation.errors);
 * }
 * ```
 */
export class SchemaLoader {
  /**
   * Load schema from a JSON file.
   *
   * Reads a JSON file containing the schema configuration and resolves any
   * environment variables using the ${VAR_NAME} syntax.
   *
   * @param filePath - Absolute or relative path to the JSON schema file
   * @returns Parsed and resolved SchemaConfig
   * @throws {Error} If file cannot be read or parsed, or if environment variables are missing
   *
   * @example
   * ```typescript
   * const schema = SchemaLoader.fromJson('./config/appsheet-schema.json');
   * const db = new SchemaManager(schema);
   * ```
   */
  static fromJson(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = JSON.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Load schema from a YAML file.
   *
   * Reads a YAML file containing the schema configuration and resolves any
   * environment variables using the ${VAR_NAME} syntax.
   *
   * @param filePath - Absolute or relative path to the YAML schema file
   * @returns Parsed and resolved SchemaConfig
   * @throws {Error} If file cannot be read or parsed, or if environment variables are missing
   *
   * @example
   * ```typescript
   * // Schema file: config/appsheet-schema.yaml
   * // connections:
   * //   worklog:
   * //     appId: ${APPSHEET_WORKLOG_APP_ID}
   * //     applicationAccessKey: ${APPSHEET_WORKLOG_ACCESS_KEY}
   *
   * const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
   * const db = new SchemaManager(schema);
   * ```
   */
  static fromYaml(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = yaml.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Load schema from an object.
   *
   * Takes a schema configuration object and resolves any environment variables.
   * Useful for programmatic schema creation or testing.
   *
   * @param schema - Schema configuration object
   * @returns Resolved SchemaConfig with environment variables substituted
   * @throws {Error} If environment variables referenced in the schema are missing
   *
   * @example
   * ```typescript
   * const schema = SchemaLoader.fromObject({
   *   connections: {
   *     worklog: {
   *       appId: '${APPSHEET_APP_ID}',
   *       applicationAccessKey: '${APPSHEET_ACCESS_KEY}',
   *       tables: { ... }
   *     }
   *   }
   * });
   * ```
   */
  static fromObject(schema: SchemaConfig): SchemaConfig {
    return this.resolveEnvVars(schema);
  }

  /**
   * Resolve environment variables in schema
   * Replaces ${VAR_NAME} with process.env.VAR_NAME
   */
  private static resolveEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const value = process.env[varName];
        if (value === undefined) {
          throw new Error(`Environment variable ${varName} is not defined`);
        }
        return value;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveEnvVars(item));
    }

    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveEnvVars(value);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Validate schema structure.
   *
   * Performs comprehensive validation of a schema configuration,
   * checking for required fields, proper structure, and completeness.
   * Returns a validation result with any errors found.
   *
   * @param schema - The schema configuration to validate
   * @returns Validation result object containing validity status and error list
   *
   * @example
   * ```typescript
   * const schema = SchemaLoader.fromYaml('./config/appsheet-schema.yaml');
   * const validation = SchemaLoader.validate(schema);
   *
   * if (!validation.valid) {
   *   console.error('Schema validation failed:');
   *   validation.errors.forEach(err => console.error('  -', err));
   *   process.exit(1);
   * }
   *
   * console.log('Schema is valid!');
   * ```
   */
  static validate(schema: SchemaConfig): SchemaValidationResult {
    const errors: string[] = [];

    // Check connections object exists
    if (!schema.connections || typeof schema.connections !== 'object') {
      errors.push('Schema must have "connections" object');
      return { valid: false, errors };
    }

    // Validate each connection
    for (const [connName, conn] of Object.entries(schema.connections)) {
      if (!conn.appId) {
        errors.push(`Connection "${connName}": missing appId`);
      }
      if (!conn.applicationAccessKey) {
        errors.push(`Connection "${connName}": missing applicationAccessKey`);
      }
      if (!conn.tables || typeof conn.tables !== 'object') {
        errors.push(`Connection "${connName}": missing or invalid tables`);
        continue;
      }

      // Validate each table
      for (const [tableName, table] of Object.entries(conn.tables)) {
        if (!table.tableName) {
          errors.push(`Connection "${connName}", table "${tableName}": missing tableName`);
        }
        if (!table.keyField) {
          errors.push(`Connection "${connName}", table "${tableName}": missing keyField`);
        }
        if (!table.fields || typeof table.fields !== 'object') {
          errors.push(`Connection "${connName}", table "${tableName}": missing or invalid fields`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
