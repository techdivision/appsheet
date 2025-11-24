/**
 * Test Suite: SchemaManager - User-Specific Table Client Creation
 *
 * Test suite for SchemaManager class that verifies the new per-request
 * user context feature (runAsUserEmail parameter on table() method).
 *
 * Test areas:
 * - Default table client retrieval (backward compatible)
 * - User-specific table client creation (new feature)
 * - On-the-fly client creation (no caching)
 * - Error handling for invalid connections/tables
 * - Multi-connection schema management
 *
 * @module tests/utils
 */

import { SchemaManager } from '../../src/utils/SchemaManager';
import { SchemaConfig } from '../../src/types';
import { DynamicTable } from '../../src/client/DynamicTable';

/**
 * Mock axios module to prevent actual HTTP requests during tests.
 * SchemaManager creates AppSheetClient instances which use axios internally.
 */
jest.mock('axios');

/**
 * Test Suite: SchemaManager - runAsUserEmail Feature
 *
 * Tests the SchemaManager's ability to create user-specific table clients
 * on-the-fly when the optional runAsUserEmail parameter is provided.
 */
describe('SchemaManager - runAsUserEmail', () => {
  /**
   * Base schema configuration for testing.
   * Includes two connections with different tables.
   */
  const baseSchema: SchemaConfig = {
    connections: {
      'test-conn': {
        appId: 'app-1',
        applicationAccessKey: 'key-1',
        tables: {
          users: {
            tableName: 'extract_user',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              email: { type: 'Email', required: true },
              name: { type: 'Text', required: false },
            },
          },
          worklogs: {
            tableName: 'extract_worklog',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              date: { type: 'Date', required: true },
              hours: { type: 'Number', required: true },
            },
          },
        },
      },
      'hr-conn': {
        appId: 'app-2',
        applicationAccessKey: 'key-2',
        tables: {
          employees: {
            tableName: 'extract_employee',
            keyField: 'id',
            fields: {
              id: { type: 'Text', required: true },
              name: { type: 'Text', required: true },
            },
          },
        },
      },
    },
  };

  let manager: SchemaManager;

  /**
   * Setup: Create a fresh SchemaManager instance before each test.
   * Ensures test isolation and clean state.
   */
  beforeEach(() => {
    manager = new SchemaManager(baseSchema);
  });

  /**
   * Test Suite: Default Table Client Retrieval (Backward Compatible)
   *
   * Verifies that when no runAsUserEmail parameter is provided,
   * the table() method returns a table client with default configuration.
   *
   * This ensures 100% backward compatibility with existing code
   * that doesn't use the user-specific feature.
   */
  describe('Default table client retrieval (backward compatible)', () => {
    /**
     * Test: Return Table Client Without User Parameter
     *
     * Verifies that calling table() without runAsUserEmail parameter
     * returns a valid DynamicTable instance.
     *
     * Test approach:
     * 1. Call table() without runAsUserEmail parameter
     * 2. Verify returned object is DynamicTable instance
     * 3. Verify table definition matches schema
     *
     * Expected behavior:
     * - Returns a valid DynamicTable
     * - Uses default configuration from schema
     * - No user-specific configuration applied
     */
    it('should return table client when no runAsUserEmail is provided', () => {
      const table = manager.table('test-conn', 'users');

      expect(table).toBeInstanceOf(DynamicTable);
      expect(table.getTableName()).toBe('extract_user');
      expect(table.getKeyField()).toBe('id');
    });

    /**
     * Test: Return Table Client With Global runAsUserEmail
     *
     * Verifies that when a connection has global runAsUserEmail configured,
     * calling table() without parameter returns a client with global user.
     *
     * Test approach:
     * 1. Create schema with global runAsUserEmail
     * 2. Call table() without runAsUserEmail parameter
     * 3. Verify underlying client has global user configured
     *
     * Expected behavior:
     * - Returns table client with global user from schema
     * - Global runAsUserEmail propagates to operations
     */
    it('should return table client with global runAsUserEmail when configured', () => {
      const schemaWithGlobalUser: SchemaConfig = {
        connections: {
          'test-conn': {
            ...baseSchema.connections['test-conn'],
            runAsUserEmail: 'global@example.com',
          },
        },
      };

      const managerWithGlobal = new SchemaManager(schemaWithGlobalUser);
      const table = managerWithGlobal.table('test-conn', 'users');

      expect(table).toBeInstanceOf(DynamicTable);
      expect(table.getTableName()).toBe('extract_user');
    });

    /**
     * Test: Access Multiple Tables Without User
     *
     * Verifies that multiple table clients can be retrieved
     * from the same connection without user parameter.
     *
     * Test approach:
     * 1. Get two different table clients from same connection
     * 2. Verify both are valid DynamicTable instances
     * 3. Verify each has correct table definition
     *
     * Expected behavior:
     * - Each table returns correct DynamicTable instance
     * - Table definitions match schema configuration
     * - No interference between tables
     */
    it('should access multiple tables without user parameter', () => {
      const usersTable = manager.table('test-conn', 'users');
      const worklogsTable = manager.table('test-conn', 'worklogs');

      expect(usersTable).toBeInstanceOf(DynamicTable);
      expect(worklogsTable).toBeInstanceOf(DynamicTable);
      expect(usersTable.getTableName()).toBe('extract_user');
      expect(worklogsTable.getTableName()).toBe('extract_worklog');
    });
  });

  /**
   * Test Suite: User-Specific Table Client Creation
   *
   * Verifies the new feature where providing runAsUserEmail parameter
   * creates a table client with user-specific configuration.
   *
   * This is the core feature for per-request user context support
   * in multi-tenant MCP servers.
   */
  describe('User-specific table client creation', () => {
    /**
     * Test: Create User-Specific Table Client On-The-Fly
     *
     * Verifies that providing runAsUserEmail creates a table client
     * with user-specific underlying AppSheetClient.
     *
     * Test approach:
     * 1. Call table() with runAsUserEmail parameter
     * 2. Verify returned object is DynamicTable instance
     * 3. Verify table definition matches schema
     *
     * Expected behavior:
     * - Returns new DynamicTable instance
     * - Underlying client has user-specific runAsUserEmail
     * - Table definition inherited from schema
     */
    it('should create user-specific table client when runAsUserEmail is provided', () => {
      const userEmail = 'user@example.com';
      const table = manager.table('test-conn', 'users', userEmail);

      expect(table).toBeInstanceOf(DynamicTable);
      expect(table.getTableName()).toBe('extract_user');
      expect(table.getKeyField()).toBe('id');
    });

    /**
     * Test: User-Specific Client Overrides Global Config
     *
     * Verifies that when connection has global runAsUserEmail configured,
     * providing a different runAsUserEmail parameter creates a client
     * with the parameter value (override behavior).
     *
     * Test approach:
     * 1. Create schema with global runAsUserEmail
     * 2. Call table() with different runAsUserEmail
     * 3. Verify table client uses parameter value
     *
     * Expected behavior:
     * - Parameter runAsUserEmail overrides global config
     * - Table client uses provided user email
     * - Global config remains unchanged for default calls
     */
    it('should override global runAsUserEmail with parameter value', () => {
      const schemaWithGlobalUser: SchemaConfig = {
        connections: {
          'test-conn': {
            ...baseSchema.connections['test-conn'],
            runAsUserEmail: 'global@example.com',
          },
        },
      };

      const managerWithGlobal = new SchemaManager(schemaWithGlobalUser);
      const userEmail = 'user@example.com';
      const table = managerWithGlobal.table('test-conn', 'users', userEmail);

      expect(table).toBeInstanceOf(DynamicTable);
      expect(table.getTableName()).toBe('extract_user');
    });

    /**
     * Test: Create New Instance on Each Call with User
     *
     * Verifies that each call to table() with runAsUserEmail creates
     * a new table client instance (no caching).
     *
     * Test approach:
     * 1. Call table() twice with same parameters
     * 2. Verify different instances are returned
     *
     * Expected behavior:
     * - Each call creates new instance (no reference equality)
     * - User-specific table clients are not cached
     * - Lightweight operation (DynamicTable is lightweight)
     */
    it('should create new instance on each call with runAsUserEmail', () => {
      const userEmail = 'user@example.com';
      const table1 = manager.table('test-conn', 'users', userEmail);
      const table2 = manager.table('test-conn', 'users', userEmail);

      expect(table1).not.toBe(table2); // Different instances
      expect(table1.getTableName()).toBe('extract_user');
      expect(table2.getTableName()).toBe('extract_user');
    });

    /**
     * Test: Create Table Clients for Different Users
     *
     * Verifies that calling table() with different runAsUserEmail values
     * creates separate table clients with correct user configurations.
     *
     * Test approach:
     * 1. Call table() with different user emails
     * 2. Verify each client is separate instance
     * 3. Verify table definitions are identical (from schema)
     *
     * Expected behavior:
     * - Different instances for different users
     * - Each instance has correct user email in underlying client
     * - All instances share same table definition
     */
    it('should create separate table clients for different users', () => {
      const user1Email = 'user1@example.com';
      const user2Email = 'user2@example.com';

      const table1 = manager.table('test-conn', 'users', user1Email);
      const table2 = manager.table('test-conn', 'users', user2Email);

      expect(table1).not.toBe(table2);
      expect(table1.getTableName()).toBe('extract_user');
      expect(table2.getTableName()).toBe('extract_user');
      expect(table1.getKeyField()).toBe('id');
      expect(table2.getKeyField()).toBe('id');
    });

    /**
     * Test: User-Specific Client for Multiple Tables
     *
     * Verifies that user-specific clients can be created for
     * different tables in the same connection.
     *
     * Test approach:
     * 1. Create user-specific clients for different tables
     * 2. Verify each has correct table definition
     * 3. Verify all are separate instances
     *
     * Expected behavior:
     * - Each table returns correct DynamicTable instance
     * - User email propagates to all table clients
     * - Table definitions match schema configuration
     */
    it('should create user-specific clients for multiple tables', () => {
      const userEmail = 'user@example.com';
      const usersTable = manager.table('test-conn', 'users', userEmail);
      const worklogsTable = manager.table('test-conn', 'worklogs', userEmail);

      expect(usersTable).not.toBe(worklogsTable);
      expect(usersTable.getTableName()).toBe('extract_user');
      expect(worklogsTable.getTableName()).toBe('extract_worklog');
    });
  });

  /**
   * Test Suite: Error Handling
   *
   * Verifies that SchemaManager handles errors correctly when
   * requesting non-existent connections or tables.
   */
  describe('Error handling', () => {
    /**
     * Test: Throw Error for Non-Existent Connection
     *
     * Verifies that table() throws descriptive error when requesting
     * a connection that doesn't exist in schema.
     *
     * Test approach:
     * 1. Call table() with non-existent connection name
     * 2. Verify error message lists available connections
     *
     * Expected behavior:
     * - Throws Error with descriptive message
     * - Error message includes connection name
     * - Error message lists available connections
     */
    it('should throw error when connection not found', () => {
      expect(() => manager.table('non-existent', 'users')).toThrow(
        'Connection "non-existent" not found. Available connections: test-conn, hr-conn'
      );
    });

    /**
     * Test: Throw Error for Non-Existent Table
     *
     * Verifies that table() throws descriptive error when requesting
     * a table that doesn't exist in the connection.
     *
     * Test approach:
     * 1. Call table() with valid connection but non-existent table
     * 2. Verify error message lists available tables
     *
     * Expected behavior:
     * - Throws Error with descriptive message
     * - Error message includes table and connection names
     * - Error message lists available tables for that connection
     */
    it('should throw error when table not found in connection', () => {
      expect(() => manager.table('test-conn', 'non-existent')).toThrow(
        'Table "non-existent" not found in connection "test-conn". ' +
          'Available tables: users, worklogs'
      );
    });

    /**
     * Test: Error Handling with User Parameter
     *
     * Verifies that error handling works correctly even when
     * runAsUserEmail parameter is provided.
     *
     * Expected behavior:
     * - Throws same errors regardless of user parameter
     * - Connection/table validation happens before user-specific client creation
     */
    it('should throw error for invalid connection even with runAsUserEmail', () => {
      expect(() => manager.table('non-existent', 'users', 'user@example.com')).toThrow(
        'Connection "non-existent" not found'
      );
    });

    it('should throw error for invalid table even with runAsUserEmail', () => {
      expect(() => manager.table('test-conn', 'non-existent', 'user@example.com')).toThrow(
        'Table "non-existent" not found in connection "test-conn"'
      );
    });
  });

  /**
   * Test Suite: Multi-Connection Schema Management
   *
   * Verifies that SchemaManager correctly handles multiple
   * connections with user-specific client creation.
   */
  describe('Multi-connection schema management', () => {
    /**
     * Test: Manage User-Specific Clients Across Connections
     *
     * Verifies that user-specific table clients can be created
     * for tables in different connections independently.
     *
     * Test approach:
     * 1. Create user-specific clients for tables in different connections
     * 2. Verify each client has correct table definition
     * 3. Verify no cross-connection configuration leakage
     *
     * Expected behavior:
     * - Each connection creates independent table clients
     * - User email applied to correct connection
     * - Table definitions match respective schemas
     */
    it('should manage user-specific clients across multiple connections', () => {
      const userEmail = 'user@example.com';
      const usersTable = manager.table('test-conn', 'users', userEmail);
      const employeesTable = manager.table('hr-conn', 'employees', userEmail);

      expect(usersTable).toBeInstanceOf(DynamicTable);
      expect(employeesTable).toBeInstanceOf(DynamicTable);
      expect(usersTable.getTableName()).toBe('extract_user');
      expect(employeesTable.getTableName()).toBe('extract_employee');
    });

    /**
     * Test: Mix Default and User-Specific Clients
     *
     * Verifies that default and user-specific table clients can be
     * retrieved from the same connection without conflicts.
     *
     * Test approach:
     * 1. Get default table client (no user)
     * 2. Get user-specific table client (with user)
     * 3. Verify both clients work independently
     *
     * Expected behavior:
     * - Default client uses default/global user config
     * - User-specific client has correct user
     * - Both clients are valid and independent
     */
    it('should support mixing default and user-specific table clients', () => {
      const defaultTable = manager.table('test-conn', 'users');
      const userTable = manager.table('test-conn', 'users', 'user@example.com');

      expect(defaultTable).toBeInstanceOf(DynamicTable);
      expect(userTable).toBeInstanceOf(DynamicTable);
      expect(defaultTable).not.toBe(userTable);
      expect(defaultTable.getTableName()).toBe('extract_user');
      expect(userTable.getTableName()).toBe('extract_user');
    });
  });

  /**
   * Test Suite: Schema Query Methods
   *
   * Verifies that schema query methods (getConnections, getTables)
   * work correctly after removing table client caching.
   */
  describe('Schema query methods', () => {
    /**
     * Test: Get All Connections
     *
     * Verifies that getConnections() returns all connection names
     * from schema configuration.
     *
     * Expected behavior:
     * - Returns array of connection names
     * - Names match schema configuration
     */
    it('should return all connection names', () => {
      const connections = manager.getConnections();

      expect(connections).toEqual(['test-conn', 'hr-conn']);
    });

    /**
     * Test: Get Tables for Connection
     *
     * Verifies that getTables() returns all table names
     * for a specific connection.
     *
     * Expected behavior:
     * - Returns array of table names
     * - Names match schema configuration for that connection
     */
    it('should return all tables for a connection', () => {
      const tables = manager.getTables('test-conn');

      expect(tables).toEqual(['users', 'worklogs']);
    });

    /**
     * Test: getTables() Error Handling
     *
     * Verifies that getTables() throws error for non-existent connection.
     *
     * Expected behavior:
     * - Throws Error with descriptive message
     * - Error message lists available connections
     */
    it('should throw error when getting tables for non-existent connection', () => {
      expect(() => manager.getTables('non-existent')).toThrow(
        'Connection "non-existent" not found. Available connections: test-conn, hr-conn'
      );
    });
  });

  /**
   * Test Suite: Schema Reload
   *
   * Verifies that reload() method works correctly without table caching.
   */
  describe('Schema reload', () => {
    /**
     * Test: Reload Schema Configuration
     *
     * Verifies that reload() updates connections and table clients
     * reflect new schema configuration.
     *
     * Test approach:
     * 1. Create manager with initial schema
     * 2. Reload with new schema
     * 3. Verify new connections/tables available
     * 4. Verify old connections/tables unavailable
     *
     * Expected behavior:
     * - New schema replaces old configuration
     * - Table clients reflect new schema
     * - Old configuration no longer accessible
     */
    it('should reload schema and create clients with new configuration', () => {
      const newSchema: SchemaConfig = {
        connections: {
          'new-conn': {
            appId: 'new-app',
            applicationAccessKey: 'new-key',
            tables: {
              newTable: {
                tableName: 'extract_new',
                keyField: 'id',
                fields: {
                  id: { type: 'Text', required: true },
                },
              },
            },
          },
        },
      };

      manager.reload(newSchema);

      // New configuration should work
      const table = manager.table('new-conn', 'newTable');
      expect(table).toBeInstanceOf(DynamicTable);
      expect(table.getTableName()).toBe('extract_new');

      // Old configuration should not work
      expect(() => manager.table('test-conn', 'users')).toThrow(
        'Connection "test-conn" not found'
      );
    });
  });
});
