/**
 * Test Suite: MockAppSheetClient
 *
 * Comprehensive test suite for the MockAppSheetClient class, which provides an in-memory
 * mock implementation of the AppSheetClientInterface for testing purposes.
 *
 * The tests verify:
 * - Database management (initialization, seeding, clearing)
 * - CRUD operations (Create, Read, Update, Delete)
 * - Convenience methods (simplified API wrappers)
 * - Configuration handling (including runAsUserEmail)
 * - Interface compliance with AppSheetClientInterface
 *
 * @module tests/client
 */

// Mock uuid before importing MockAppSheetClient to avoid ES module issues in Jest
jest.mock('uuid');

import { MockAppSheetClient } from '../../src/client/MockAppSheetClient';
import { ValidationError, NotFoundError } from '../../src/types';

/**
 * Test data interface representing a User entity.
 * Includes optional audit fields that are auto-populated by the mock client.
 */
interface User {
  id: string;
  name: string;
  email?: string;
  status?: string;
  created_at?: string;
  created_by?: string;
  modified_at?: string;
  modified_by?: string;
}

/**
 * Test data interface representing a Product entity.
 */
interface Product {
  id: string;
  name: string;
}

/**
 * Test Suite: MockAppSheetClient Core Functionality
 *
 * Tests the complete lifecycle of the MockAppSheetClient including initialization,
 * CRUD operations, database management, and interface compliance.
 */
describe('MockAppSheetClient', () => {
  let client: MockAppSheetClient;

  /**
   * Setup: Initialize a fresh MockAppSheetClient instance before each test.
   * Ensures test isolation by providing a clean database state.
   */
  beforeEach(() => {
    client = new MockAppSheetClient({
      appId: 'mock-app',
      applicationAccessKey: 'mock-key',
    });
  });

  /**
   * Test Suite: Database Management
   *
   * Verifies the mock database lifecycle management including initialization,
   * seeding with test data, and cleanup operations.
   */
  describe('Database Management', () => {
    /**
     * Test: Initial State - Empty Database
     *
     * Verifies that a newly instantiated MockAppSheetClient starts with an empty
     * in-memory database. This ensures test isolation and predictable initial state.
     *
     * Expected behavior:
     * - findAll() on any table returns an empty array
     * - No pre-existing data interferes with tests
     */
    it('should start with empty database', async () => {
      const users = await client.findAll<User>('users');
      expect(users).toEqual([]);
    });

    /**
     * Test: Database Seeding with Default Data
     *
     * Verifies the seedDatabase() method populates the mock database with
     * predefined example data for quick testing scenarios.
     *
     * Expected behavior:
     * - service_portfolio table: 50 example records
     * - area table: 3 example records
     * - category table: 4 example records
     *
     * Note: This uses the deprecated default seeding mechanism. For production
     * tests, prefer using MockDataProvider for project-specific test data.
     */
    it('should seed database with default data', () => {
      client.seedDatabase();
      // Default data includes service_portfolio, area, category tables
      expect(client.findAll('service_portfolio')).resolves.toHaveLength(50);
      expect(client.findAll('area')).resolves.toHaveLength(3);
      expect(client.findAll('category')).resolves.toHaveLength(4);
    });

    /**
     * Test: Clear Entire Database
     *
     * Verifies that clearDatabase() removes all data from all tables,
     * resetting the mock database to its initial empty state.
     *
     * Test steps:
     * 1. Add a user to populate the database
     * 2. Verify the user exists
     * 3. Clear the entire database
     * 4. Verify all tables are empty
     *
     * Use case: Cleanup between test scenarios without reinitializing the client
     */
    it('should clear database', async () => {
      await client.addOne<User>('users', { id: '1', name: 'John' });
      expect(await client.findAll<User>('users')).toHaveLength(1);

      client.clearDatabase();
      expect(await client.findAll<User>('users')).toHaveLength(0);
    });

    /**
     * Test: Clear Specific Table
     *
     * Verifies that clearTable() removes data only from the specified table
     * while leaving other tables untouched.
     *
     * Test steps:
     * 1. Add data to multiple tables (users, products)
     * 2. Clear only the users table
     * 3. Verify users table is empty
     * 4. Verify products table still contains data
     *
     * Use case: Selective cleanup for tests that need to reset only certain data
     */
    it('should clear specific table', async () => {
      await client.addOne<User>('users', { id: '1', name: 'John' });
      await client.addOne<Product>('products', { id: '1', name: 'Product' });

      client.clearTable('users');
      expect(await client.findAll<User>('users')).toHaveLength(0);
      expect(await client.findAll<Product>('products')).toHaveLength(1);
    });
  });

  /**
   * Test Suite: CRUD Operations - Add (Create)
   *
   * Verifies the add() operation which creates new rows in the mock database.
   * Tests cover single/multiple row insertion, auto-ID generation, and
   * audit field population (created_at, created_by).
   */
  describe('CRUD Operations - Add', () => {
    /**
     * Test: Add Single Row
     *
     * Verifies that add() successfully inserts a single row into the database
     * with all provided fields, and automatically adds audit fields.
     *
     * Expected behavior:
     * - Row is stored with all provided fields (id, name, email)
     * - created_at timestamp is automatically added
     * - created_by is set to default 'mock@example.com'
     * - Response contains exactly one row
     *
     * This is the most common use case for creating data in tests.
     */
    it('should add single row', async () => {
      const result = await client.add<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John', email: 'john@example.com' }],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        id: '1',
        name: 'John',
        email: 'john@example.com',
      });
      expect(result.rows[0]).toHaveProperty('created_at');
      expect(result.rows[0]).toHaveProperty('created_by', 'mock@example.com');
    });

    /**
     * Test: Add Multiple Rows in Single Operation
     *
     * Verifies that add() can insert multiple rows in a single batch operation,
     * mimicking the AppSheet API's bulk insert capability.
     *
     * Expected behavior:
     * - Both rows are inserted successfully
     * - Each row maintains its distinct data
     * - Response contains all inserted rows in order
     *
     * Use case: Efficient batch data setup for tests requiring multiple records
     */
    it('should add multiple rows', async () => {
      const result = await client.add<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
        ],
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('John');
      expect(result.rows[1].name).toBe('Jane');
    });

    /**
     * Test: Auto-Generate ID When Not Provided
     *
     * Verifies that the mock client automatically generates a unique ID
     * when the provided ID is empty or missing, mimicking AppSheet's
     * auto-key generation behavior.
     *
     * Expected behavior:
     * - Empty ID ('') triggers auto-generation
     * - Generated ID is a non-empty string
     * - ID is unique (uses mocked UUID)
     *
     * Use case: Tests where specific IDs are not important, allowing
     * the mock to generate them automatically
     */
    it('should auto-generate ID if not provided', async () => {
      const result = await client.add<User>({
        tableName: 'users',
        rows: [{ id: '', name: 'John' }], // Provide empty id, will be auto-generated
      });

      expect(result.rows[0]).toHaveProperty('id');
      expect(typeof result.rows[0].id).toBe('string');
      expect(result.rows[0].id.length).toBeGreaterThan(0);
    });

    /**
     * Test: Use Global runAsUserEmail from Configuration
     *
     * Verifies that when runAsUserEmail is configured globally on the client,
     * it is automatically applied to the created_by field for all add operations.
     *
     * Expected behavior:
     * - created_by field is set to the configured runAsUserEmail
     * - Global setting applies to all operations unless overridden
     *
     * Use case: Testing audit trails and permission contexts where all
     * operations should be attributed to a specific user
     */
    it('should use runAsUserEmail from config', async () => {
      const clientWithUser = new MockAppSheetClient({
        appId: 'mock-app',
        applicationAccessKey: 'mock-key',
        runAsUserEmail: 'admin@example.com',
      });

      const result = await clientWithUser.add<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John' }],
      });

      expect(result.rows[0].created_by).toBe('admin@example.com');
    });

    /**
     * Test: Override Global runAsUserEmail Per Operation
     *
     * Verifies that the per-operation RunAsUserEmail property overrides
     * the global configuration, allowing specific operations to run as
     * different users.
     *
     * Expected behavior:
     * - Operation-level RunAsUserEmail takes precedence over global config
     * - created_by reflects the operation-level user
     * - Global config is not permanently changed
     *
     * Use case: Testing scenarios where certain operations need elevated
     * privileges or must be attributed to system/service accounts
     */
    it('should override runAsUserEmail per operation', async () => {
      const result = await client.add<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John' }],
        properties: { RunAsUserEmail: 'system@example.com' },
      });

      expect(result.rows[0].created_by).toBe('system@example.com');
    });
  });

  /**
   * Test Suite: CRUD Operations - Find (Read)
   *
   * Verifies the find() operation which retrieves rows from the database
   * with optional filtering using AppSheet selector syntax.
   * Tests cover various selector patterns and edge cases.
   */
  describe('CRUD Operations - Find', () => {
    /**
     * Setup: Populate database with test users for querying.
     * Creates 3 users with different status values for selector testing.
     */
    beforeEach(async () => {
      await client.add<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John', status: 'active' },
          { id: '2', name: 'Jane', status: 'active' },
          { id: '3', name: 'Bob', status: 'inactive' },
        ],
      });
    });

    /**
     * Test: Find All Rows Without Filter
     *
     * Verifies that find() without a selector returns all rows in the table.
     *
     * Expected behavior:
     * - All 3 rows are returned
     * - No filtering is applied
     * - Results are returned in insertion order
     *
     * Use case: Retrieving complete table contents for verification
     */
    it('should find all rows', async () => {
      const result = await client.find<User>({ tableName: 'users' });
      expect(result.rows).toHaveLength(3);
    });

    /**
     * Test: Find with Exact Match Selector (Double Quotes)
     *
     * Verifies that AppSheet selector syntax `[field] = "value"` correctly
     * filters rows based on exact string matching.
     *
     * Expected behavior:
     * - Only rows matching the exact field value are returned
     * - Double quotes are properly parsed
     * - Case-sensitive matching
     *
     * Use case: Precise field-based queries mimicking AppSheet filter behavior
     */
    it('should find rows with selector (exact match)', async () => {
      const result = await client.find<User>({
        tableName: 'users',
        selector: '[name] = "John"',
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('John');
    });

    /**
     * Test: Find with Exact Match Selector (Single Quotes)
     *
     * Verifies that the selector parser handles both single and double quotes
     * for string values, ensuring compatibility with different AppSheet syntax styles.
     *
     * Expected behavior:
     * - Single quotes work identically to double quotes
     * - Multiple rows matching the condition are returned
     *
     * Use case: Testing selector syntax flexibility
     */
    it('should find rows with selector (single quotes)', async () => {
      const result = await client.find<User>({
        tableName: 'users',
        selector: "[status] = 'active'",
      });

      expect(result.rows).toHaveLength(2);
    });

    /**
     * Test: Find with IN Selector for Multiple Values
     *
     * Verifies that the IN selector syntax allows matching against multiple
     * values, mimicking SQL-like IN clause behavior.
     *
     * Selector format: `[field] IN ("value1", "value2")`
     *
     * Expected behavior:
     * - Rows matching any of the values are returned
     * - Case-sensitive matching
     * - Multiple values are properly parsed from comma-separated list
     *
     * Use case: Filtering by multiple possible values (e.g., status IN ("pending", "active"))
     */
    it('should find rows with IN selector', async () => {
      const result = await client.find<User>({
        tableName: 'users',
        selector: '[name] IN ("John", "Jane")',
      });

      expect(result.rows).toHaveLength(2);
    });

    /**
     * Test: Empty Result for Non-Matching Selector
     *
     * Verifies that find() returns an empty array when no rows match the
     * selector criteria, rather than throwing an error.
     *
     * Expected behavior:
     * - Empty array is returned
     * - No error is thrown
     * - Response structure remains valid
     *
     * Use case: Graceful handling of queries with no results
     */
    it('should return empty array for non-matching selector', async () => {
      const result = await client.find<User>({
        tableName: 'users',
        selector: '[name] = "NonExistent"',
      });

      expect(result.rows).toHaveLength(0);
    });
  });

  /**
   * Test Suite: CRUD Operations - Update (Edit)
   *
   * Verifies the update() operation which modifies existing rows in the database.
   * Tests cover single/multiple row updates, field merging, validation, error handling,
   * and audit field population (modified_at, modified_by).
   */
  describe('CRUD Operations - Update', () => {
    /**
     * Setup: Populate database with test users for updating.
     * Creates 2 users with known data for update testing.
     */
    beforeEach(async () => {
      await client.add<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John', email: 'john@example.com' },
          { id: '2', name: 'Jane', email: 'jane@example.com' },
        ],
      });
    });

    /**
     * Test: Update Single Row
     *
     * Verifies that update() successfully modifies an existing row's fields
     * and automatically adds modification audit fields.
     *
     * Expected behavior:
     * - Specified fields are updated (name)
     * - modified_at timestamp is automatically added
     * - modified_by is set to default 'mock@example.com'
     * - Only the specified row is modified
     *
     * Use case: Standard data modification in tests
     */
    it('should update single row', async () => {
      const result = await client.update<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John Updated' }],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('John Updated');
      expect(result.rows[0]).toHaveProperty('modified_at');
      expect(result.rows[0]).toHaveProperty('modified_by', 'mock@example.com');
    });

    /**
     * Test: Update Multiple Rows in Single Operation
     *
     * Verifies that update() can modify multiple rows in a single batch operation.
     *
     * Expected behavior:
     * - Both rows are updated successfully
     * - Each row receives its specified updates
     * - Response contains all updated rows
     *
     * Use case: Efficient batch updates for test data
     */
    it('should update multiple rows', async () => {
      const result = await client.update<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John Updated' },
          { id: '2', name: 'Jane Updated' },
        ],
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('John Updated');
      expect(result.rows[1].name).toBe('Jane Updated');
    });

    /**
     * Test: Preserve Unchanged Fields During Update
     *
     * Verifies that update() performs a partial update (merge), preserving
     * fields that are not explicitly provided in the update data.
     *
     * Test steps:
     * 1. Update only the name field
     * 2. Verify name is updated
     * 3. Verify email field remains unchanged
     *
     * Expected behavior:
     * - Only specified fields are modified
     * - Unspecified fields retain their original values
     * - No data loss occurs on partial updates
     *
     * Use case: Selective field updates without needing complete row data
     */
    it('should preserve unchanged fields', async () => {
      const result = await client.update<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John Updated' }],
      });

      expect(result.rows[0].email).toBe('john@example.com');
    });

    /**
     * Test: Validation Error for Missing Key Field
     *
     * Verifies that update() throws ValidationError when the key field (id)
     * is missing or empty, preventing ambiguous updates.
     *
     * Expected behavior:
     * - ValidationError is thrown
     * - No data is modified
     * - Error message indicates missing key field
     *
     * Use case: Ensuring data integrity by preventing invalid updates
     */
    it('should throw ValidationError if key field is missing', async () => {
      await expect(
        client.update<User>({
          tableName: 'users',
          rows: [{ id: '', name: 'John Updated' }], // Missing id
        })
      ).rejects.toThrow(ValidationError);
    });

    /**
     * Test: NotFoundError for Non-Existent Row
     *
     * Verifies that update() throws NotFoundError when attempting to update
     * a row that doesn't exist in the database.
     *
     * Expected behavior:
     * - NotFoundError is thrown
     * - No data is modified
     * - Error indicates which row was not found
     *
     * Use case: Proper error handling for update operations on missing data
     */
    it('should throw NotFoundError if row does not exist', async () => {
      await expect(
        client.update<User>({
          tableName: 'users',
          rows: [{ id: '999', name: 'NonExistent' }],
        })
      ).rejects.toThrow(NotFoundError);
    });

    /**
     * Test: Override runAsUserEmail for Update Operation
     *
     * Verifies that the per-operation RunAsUserEmail property is applied
     * to the modified_by audit field during updates.
     *
     * Expected behavior:
     * - modified_by reflects the operation-level user
     * - Audit trail accurately tracks who made the modification
     *
     * Use case: Testing audit trails with specific user attributions
     */
    it('should use runAsUserEmail from properties', async () => {
      const result = await client.update<User>({
        tableName: 'users',
        rows: [{ id: '1', name: 'John Updated' }],
        properties: { RunAsUserEmail: 'admin@example.com' },
      });

      expect(result.rows[0].modified_by).toBe('admin@example.com');
    });
  });

  /**
   * Test Suite: CRUD Operations - Delete
   *
   * Verifies the delete() operation which removes rows from the database.
   * Tests cover single/multiple row deletion, validation, and graceful
   * handling of non-existent rows.
   */
  describe('CRUD Operations - Delete', () => {
    /**
     * Setup: Populate database with test users for deletion.
     * Creates 3 users to test various deletion scenarios.
     */
    beforeEach(async () => {
      await client.add<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
          { id: '3', name: 'Bob' },
        ],
      });
    });

    /**
     * Test: Delete Single Row
     *
     * Verifies that delete() successfully removes a single row from the database.
     *
     * Test steps:
     * 1. Delete user with id='1'
     * 2. Verify operation reports success and deletedCount=1
     * 3. Verify remaining rows count is correct
     *
     * Expected behavior:
     * - Row is permanently removed from database
     * - Delete response indicates success
     * - Only specified row is deleted
     *
     * Use case: Standard data cleanup in tests
     */
    it('should delete single row', async () => {
      const result = await client.delete<User>({
        tableName: 'users',
        rows: [{ id: '1', name: '' }],
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);

      const remaining = await client.findAll<User>('users');
      expect(remaining).toHaveLength(2);
    });

    /**
     * Test: Delete Multiple Rows in Single Operation
     *
     * Verifies that delete() can remove multiple rows in a single batch operation.
     *
     * Expected behavior:
     * - Both rows are deleted
     * - deletedCount accurately reflects number of rows removed
     * - Remaining rows are unaffected
     *
     * Use case: Efficient batch cleanup for test data
     */
    it('should delete multiple rows', async () => {
      const result = await client.delete<User>({
        tableName: 'users',
        rows: [{ id: '1', name: '' }, { id: '2', name: '' }],
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);

      const remaining = await client.findAll<User>('users');
      expect(remaining).toHaveLength(1);
    });

    /**
     * Test: Validation Error for Missing Key Field
     *
     * Verifies that delete() throws ValidationError when the key field (id)
     * is missing or empty, preventing ambiguous deletions.
     *
     * Expected behavior:
     * - ValidationError is thrown
     * - No data is deleted
     * - Error message indicates missing key field
     *
     * Use case: Preventing accidental mass deletions due to missing identifiers
     */
    it('should throw ValidationError if key field is missing', async () => {
      await expect(
        client.delete<User>({
          tableName: 'users',
          rows: [{ id: '', name: 'John' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    /**
     * Test: Graceful Handling of Non-Existent Row Deletion
     *
     * Verifies that delete() handles attempts to delete non-existent rows gracefully
     * without throwing an error, mimicking AppSheet API behavior.
     *
     * Expected behavior:
     * - Operation reports success=true
     * - deletedCount is 0
     * - No error is thrown
     * - Database state is unchanged
     *
     * Use case: Idempotent delete operations in tests
     */
    it('should not throw error if row does not exist', async () => {
      const result = await client.delete<User>({
        tableName: 'users',
        rows: [{ id: '999', name: '' }],
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });
  });

  /**
   * Test Suite: Convenience Methods
   *
   * Verifies the simplified convenience wrapper methods that provide
   * a more ergonomic API for common single-row operations.
   * These methods wrap the core CRUD operations with simpler signatures.
   */
  describe('Convenience Methods', () => {
    /**
     * Setup: Populate database with test users for convenience method testing.
     */
    beforeEach(async () => {
      await client.add<User>({
        tableName: 'users',
        rows: [
          { id: '1', name: 'John', email: 'john@example.com' },
          { id: '2', name: 'Jane', email: 'jane@example.com' },
        ],
      });
    });

    /**
     * Test: findAll() Convenience Method
     *
     * Verifies that findAll() returns all rows from a table without
     * requiring the full options object structure.
     *
     * Expected behavior:
     * - Returns array of rows directly (not wrapped in response object)
     * - All rows are returned
     * - Simplified API reduces boilerplate
     *
     * Use case: Quick data retrieval in tests
     */
    it('findAll should return all rows', async () => {
      const users = await client.findAll<User>('users');
      expect(users).toHaveLength(2);
    });

    /**
     * Test: findOne() Returns First Match
     *
     * Verifies that findOne() returns the first row matching the selector
     * as a direct object (not array).
     *
     * Expected behavior:
     * - Returns single matching row
     * - Returns null if no match (not empty array)
     * - Simplified API for single-row queries
     *
     * Use case: Fetching specific records by criteria
     */
    it('findOne should return first matching row', async () => {
      const user = await client.findOne<User>('users', '[name] = "John"');
      expect(user).not.toBeNull();
      expect(user?.name).toBe('John');
    });

    /**
     * Test: findOne() Returns Null for No Match
     *
     * Verifies that findOne() returns null when no rows match the selector.
     *
     * Expected behavior:
     * - Returns null (not undefined or empty array)
     * - Allows safe optional chaining (user?.field)
     * - Consistent with single-row semantics
     *
     * Use case: Conditional logic based on record existence
     */
    it('findOne should return null if no match', async () => {
      const user = await client.findOne<User>('users', '[name] = "NonExistent"');
      expect(user).toBeNull();
    });

    /**
     * Test: addOne() Convenience Method
     *
     * Verifies that addOne() adds a single row and returns it directly
     * without requiring array wrapping.
     *
     * Expected behavior:
     * - Returns created row directly (not in array)
     * - Simplified API for single-row inserts
     * - Common use case in tests
     *
     * Use case: Quick test data creation
     */
    it('addOne should add single row', async () => {
      const user = await client.addOne<User>('users', {
        id: '3',
        name: 'Bob',
      });

      expect(user.id).toBe('3');
      expect(user.name).toBe('Bob');
    });

    /**
     * Test: updateOne() Convenience Method
     *
     * Verifies that updateOne() updates a single row and returns it directly.
     *
     * Expected behavior:
     * - Returns updated row directly (not in array)
     * - Simplified API for single-row updates
     *
     * Use case: Quick data modifications in tests
     */
    it('updateOne should update single row', async () => {
      const user = await client.updateOne<User>('users', {
        id: '1',
        name: 'John Updated',
      });

      expect(user.name).toBe('John Updated');
    });

    /**
     * Test: deleteOne() Convenience Method
     *
     * Verifies that deleteOne() deletes a single row and returns a simple boolean.
     *
     * Expected behavior:
     * - Returns true for successful deletion
     * - Simplified API for single-row deletions
     * - No need to check response object structure
     *
     * Use case: Quick data cleanup in tests
     */
    it('deleteOne should delete single row', async () => {
      const result = await client.deleteOne<User>('users', { id: '1', name: '' });
      expect(result).toBe(true);

      const remaining = await client.findAll<User>('users');
      expect(remaining).toHaveLength(1);
    });
  });

  /**
   * Test Suite: Configuration Management
   *
   * Verifies that the client properly stores and retrieves configuration
   * values including default values and optional parameters.
   */
  describe('Configuration', () => {
    /**
     * Test: Retrieve Default Configuration
     *
     * Verifies that getConfig() returns all configuration values including
     * defaults that were applied during client initialization.
     *
     * Expected behavior:
     * - Provided values are returned (appId, applicationAccessKey)
     * - Default values are returned (baseUrl, timeout, retryAttempts)
     * - Configuration is read-only (via Readonly type)
     *
     * Use case: Debugging client configuration in tests
     */
    it('should return configuration', () => {
      const config = client.getConfig();
      expect(config.appId).toBe('mock-app');
      expect(config.applicationAccessKey).toBe('mock-key');
      expect(config.baseUrl).toBe('https://api.appsheet.com/api/v2');
      expect(config.timeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
    });

    /**
     * Test: Configuration Includes Optional runAsUserEmail
     *
     * Verifies that when runAsUserEmail is provided during client initialization,
     * it is included in the returned configuration.
     *
     * Expected behavior:
     * - runAsUserEmail is present in config when provided
     * - Value matches what was provided during initialization
     *
     * Use case: Verifying user context configuration
     */
    it('should include runAsUserEmail in config if provided', () => {
      const clientWithUser = new MockAppSheetClient({
        appId: 'mock-app',
        applicationAccessKey: 'mock-key',
        runAsUserEmail: 'admin@example.com',
      });

      const config = clientWithUser.getConfig();
      expect(config.runAsUserEmail).toBe('admin@example.com');
    });
  });

  /**
   * Test Suite: Interface Compliance
   *
   * Verifies that MockAppSheetClient correctly implements the
   * AppSheetClientInterface, ensuring it can be used interchangeably
   * with the real AppSheetClient in code that depends on the interface.
   */
  describe('Interface Compliance', () => {
    /**
     * Test: Implements AppSheetClientInterface
     *
     * Verifies that MockAppSheetClient implements all required methods
     * from AppSheetClientInterface, enabling polymorphic usage.
     *
     * Test approach:
     * 1. Type check: Assign client to interface type (compile-time check)
     * 2. Runtime check: Verify all interface methods exist and are functions
     *
     * Expected behavior:
     * - All 10 interface methods are present
     * - All methods are of type 'function'
     * - Type system allows treating mock as interface
     *
     * Use case: Ensuring MockAppSheetClient can substitute AppSheetClient
     * in test scenarios, enabling dependency injection and mocking patterns
     */
    it('should implement AppSheetClientInterface', () => {
      // Type check: This ensures MockAppSheetClient implements AppSheetClientInterface
      const clientInterface: import('../../src/types').AppSheetClientInterface = client;

      // Check all required methods exist
      expect(typeof clientInterface.add).toBe('function');
      expect(typeof clientInterface.find).toBe('function');
      expect(typeof clientInterface.update).toBe('function');
      expect(typeof clientInterface.delete).toBe('function');
      expect(typeof clientInterface.findAll).toBe('function');
      expect(typeof clientInterface.findOne).toBe('function');
      expect(typeof clientInterface.addOne).toBe('function');
      expect(typeof clientInterface.updateOne).toBe('function');
      expect(typeof clientInterface.deleteOne).toBe('function');
      expect(typeof clientInterface.getConfig).toBe('function');
    });
  });
});
