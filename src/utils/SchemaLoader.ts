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
   * Load schema from JSON file
   */
  static fromJson(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = JSON.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Load schema from YAML file
   */
  static fromYaml(filePath: string): SchemaConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schema = yaml.parse(content);
    return this.resolveEnvVars(schema);
  }

  /**
   * Load schema from object (for programmatic use)
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
   * Validate schema structure
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
