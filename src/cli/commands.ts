/**
 * CLI commands for schema management
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import * as fs from 'fs';
import { AppSheetClient } from '../client';
import { SchemaInspector } from './SchemaInspector';
import { SchemaLoader } from '../utils';
import { SchemaConfig } from '../types';

/**
 * Create CLI program with all commands
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name('appsheet')
    .description('AppSheet Schema Management CLI')
    .version('0.1.0');

  // Command: init
  program
    .command('init')
    .description('Initialize a new schema file')
    .option('-o, --output <path>', 'Output file path', 'config/appsheet-schema.yaml')
    .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
    .action(async (options) => {
      const schema: SchemaConfig = {
        connections: {
          default: {
            appId: '${APPSHEET_APP_ID}',
            applicationAccessKey: '${APPSHEET_ACCESS_KEY}',
            tables: {},
          },
        },
      };

      const output =
        options.format === 'json' ? JSON.stringify(schema, null, 2) : yaml.stringify(schema);

      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✓ Schema file created: ${options.output}`);
    });

  // Command: inspect
  program
    .command('inspect')
    .description('Inspect an AppSheet app and generate schema')
    .requiredOption('--app-id <id>', 'AppSheet App ID')
    .requiredOption('--access-key <key>', 'AppSheet Access Key')
    .option('--tables <tables>', 'Comma-separated list of table names')
    .option('--run-as-user-email <email>', 'Run API calls as specific user (for security filters)')
    .option('--connection-name <name>', 'Connection name', 'default')
    .option('-o, --output <path>', 'Output file path', 'config/appsheet-schema.yaml')
    .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
    .option('--auto-discover', 'Attempt to automatically discover all tables', false)
    .action(async (options) => {
      try {
        const client = new AppSheetClient({
          appId: options.appId,
          applicationAccessKey: options.accessKey,
          runAsUserEmail: options.runAsUserEmail,
        });

        const inspector = new SchemaInspector(client);
        let tableNames: string[];

        // Determine table names
        if (options.tables) {
          tableNames = options.tables.split(',').map((t: string) => t.trim());
        } else {
          console.log('No tables specified. Attempting auto-discovery...');
          tableNames = await inspector.discoverTables();

          if (tableNames.length === 0) {
            tableNames = await inspector.promptForTables();
          } else {
            console.log(`✓ Discovered ${tableNames.length} tables: ${tableNames.join(', ')}`);
          }
        }

        if (tableNames.length === 0) {
          console.error('No tables specified. Aborting.');
          process.exit(1);
        }

        console.log(`\nInspecting ${tableNames.length} tables...`);
        const connection = await inspector.generateSchema(options.connectionName, tableNames);

        const schema: SchemaConfig = {
          connections: {
            [options.connectionName]: connection,
          },
        };

        const output =
          options.format === 'json' ? JSON.stringify(schema, null, 2) : yaml.stringify(schema);

        fs.writeFileSync(options.output, output, 'utf-8');
        console.log(`\n✓ Schema generated: ${options.output}`);
        console.log('✓ Inspected tables:', tableNames.join(', '));
        console.log('\nPlease review and update:');
        console.log('  - Key fields may need manual adjustment');
        console.log('  - Field types are inferred and may need refinement');
        console.log('  - Add required, enum, and description properties as needed');
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: validate
  program
    .command('validate')
    .description('Validate schema file')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action((options) => {
      try {
        const content = fs.readFileSync(options.schema, 'utf-8');
        const schema = yaml.parse(content);
        const validation = SchemaLoader.validate(schema);

        if (validation.valid) {
          console.log('✓ Schema is valid');
        } else {
          console.error('✗ Schema validation failed:');
          validation.errors.forEach((err) => console.error(`  - ${err}`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // Command: add-table
  program
    .command('add-table <connection> <tableName>')
    .description('Add a table to an existing connection')
    .option('-s, --schema <path>', 'Schema file path', 'config/appsheet-schema.yaml')
    .action(async (connection, tableName, options) => {
      try {
        // Load existing schema
        const existingContent = fs.readFileSync(options.schema, 'utf-8');
        const schema: SchemaConfig = yaml.parse(existingContent);

        if (!schema.connections[connection]) {
          throw new Error(`Connection "${connection}" not found in schema`);
        }

        // Create client from existing connection config
        const connDef = schema.connections[connection];
        const client = new AppSheetClient({
          appId: connDef.appId,
          applicationAccessKey: connDef.applicationAccessKey,
        });

        const inspector = new SchemaInspector(client);

        console.log(`Inspecting table "${tableName}"...`);
        const inspection = await inspector.inspectTable(tableName);

        // Add to schema
        const schemaName = inspector.toSchemaName(tableName);
        schema.connections[connection].tables[schemaName] = {
          tableName: inspection.tableName,
          keyField: inspection.keyField,
          fields: inspection.fields,
        };

        // Write back
        const output = yaml.stringify(schema);
        fs.writeFileSync(options.schema, output, 'utf-8');
        console.log(`✓ Table "${tableName}" added to connection "${connection}"`);
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  return program;
}
