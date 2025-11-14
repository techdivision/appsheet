/**
 * Test Suite: AppSheetClient - runAsUserEmail Functionality
 *
 * Integration test suite for the AppSheetClient class that verifies the
 * runAsUserEmail feature works correctly with the real HTTP client (mocked axios).
 *
 * Unlike MockAppSheetClient tests which use in-memory storage, these tests verify
 * that the client correctly formats HTTP requests to the AppSheet API, specifically
 * testing how the runAsUserEmail configuration is propagated to API requests.
 *
 * Test areas:
 * - Global runAsUserEmail configuration (applied to all operations)
 * - Per-operation runAsUserEmail override (operation-specific user context)
 * - Property merging (combining runAsUserEmail with other request properties)
 * - Convenience methods (simplified API with runAsUserEmail support)
 * - Configuration retrieval (getConfig() method)
 *
 * @module tests/client
 */

import axios from 'axios';
import { AppSheetClient } from '../../src/client/AppSheetClient';

/**
 * Mock axios module to intercept HTTP requests without hitting real API.
 * This allows us to verify request structure and runAsUserEmail inclusion.
 */
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Test Suite: AppSheetClient - runAsUserEmail Feature
 *
 * Tests the real AppSheetClient implementation (not the mock) by verifying
 * HTTP request payloads contain correct runAsUserEmail values in the
 * Properties field of AppSheet API requests.
 */
describe('AppSheetClient - runAsUserEmail', () => {
  /**
   * Base configuration for creating AppSheetClient instances in tests.
   * Minimal config with only required fields.
   */
  const mockConfig = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
  };

  /**
   * Mocked axios instance that captures HTTP POST requests.
   * Allows verification of request structure without network calls.
   */
  const mockAxiosInstance = {
    post: jest.fn(),
  };

  /**
   * Setup: Reset all mocks and configure axios before each test.
   * Ensures test isolation and clean state for HTTP request verification.
   */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  /**
   * Test Suite: Global runAsUserEmail Configuration
   *
   * Verifies that when runAsUserEmail is configured globally on the client,
   * it is automatically included in all HTTP requests to the AppSheet API
   * in the Properties.RunAsUserEmail field.
   *
   * Tests cover all CRUD operations (Find, Add, Edit/Update, Delete) to ensure
   * consistent behavior across different API action types.
   */
  describe('Global runAsUserEmail configuration', () => {
    /**
     * Test: Global runAsUserEmail Included in Find Request
     *
     * Verifies that when a client is initialized with global runAsUserEmail,
     * the HTTP request payload includes it in the Properties field.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail
     * 2. Execute a find operation
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present with correct value
     *
     * Expected behavior:
     * - HTTP request contains Properties object
     * - Properties.RunAsUserEmail equals configured value
     * - All subsequent requests include this value automatically
     *
     * Use case: Setting up audit trail / user context for all operations
     */
    it('should include RunAsUserEmail in Properties when globally configured', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'global@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.findAll('TestTable');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'global@example.com',
          }),
        })
      );
    });

    /**
     * Test: No runAsUserEmail When Not Configured
     *
     * Verifies that when runAsUserEmail is not configured, the HTTP request
     * Properties field remains empty, avoiding unnecessary API parameters.
     *
     * Expected behavior:
     * - Properties object exists but is empty
     * - No RunAsUserEmail field is included
     * - API request is minimal and clean
     *
     * Use case: Operations not requiring user context
     */
    it('should not include RunAsUserEmail when not configured', async () => {
      const client = new AppSheetClient(mockConfig);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.findAll('TestTable');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: {},
        })
      );
    });

    /**
     * Test: Global runAsUserEmail Included in Add Request
     *
     * Verifies that Add (Create) operations include the global runAsUserEmail
     * in the HTTP request payload's Properties field.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='admin@example.com'
     * 2. Execute an add operation to create new rows
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present with correct value
     * 5. Verify Action field is set to 'Add'
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Add'
     * - Properties.RunAsUserEmail equals 'admin@example.com'
     * - Global runAsUserEmail applies to create operations automatically
     *
     * Use case: Audit trail showing which admin user created new records
     */
    it('should apply global runAsUserEmail to add operations', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'admin@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123' }] },
      });

      await client.add({
        tableName: 'Users',
        rows: [{ name: 'John' }],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Add',
          Properties: expect.objectContaining({
            RunAsUserEmail: 'admin@example.com',
          }),
        })
      );
    });

    /**
     * Test: Global runAsUserEmail Included in Update Request
     *
     * Verifies that Update (Edit) operations include the global runAsUserEmail
     * in the HTTP request payload's Properties field.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='editor@example.com'
     * 2. Execute an update operation to modify existing rows
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present with correct value
     * 5. Verify Action field is set to 'Edit' (AppSheet uses 'Edit', not 'Update')
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Edit'
     * - Properties.RunAsUserEmail equals 'editor@example.com'
     * - Global runAsUserEmail applies to update operations automatically
     *
     * Use case: Audit trail showing which user modified records
     * Note: AppSheet API uses 'Edit' action name for update operations
     */
    it('should apply global runAsUserEmail to update operations', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'editor@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123', name: 'Updated' }] },
      });

      await client.update({
        tableName: 'Users',
        rows: [{ id: '123', name: 'Updated' }],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Edit',
          Properties: expect.objectContaining({
            RunAsUserEmail: 'editor@example.com',
          }),
        })
      );
    });

    /**
     * Test: Global runAsUserEmail Included in Delete Request
     *
     * Verifies that Delete operations include the global runAsUserEmail
     * in the HTTP request payload's Properties field.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='deleter@example.com'
     * 2. Execute a delete operation to remove rows
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present with correct value
     * 5. Verify Action field is set to 'Delete'
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Delete'
     * - Properties.RunAsUserEmail equals 'deleter@example.com'
     * - Global runAsUserEmail applies to delete operations automatically
     * - Response Rows array is empty (rows are deleted, not returned)
     *
     * Use case: Audit trail showing which user deleted records
     * Important: Delete operations typically return empty Rows array
     */
    it('should apply global runAsUserEmail to delete operations', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'deleter@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.delete({
        tableName: 'Users',
        rows: [{ id: '123' }],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Delete',
          Properties: expect.objectContaining({
            RunAsUserEmail: 'deleter@example.com',
          }),
        })
      );
    });
  });

  /**
   * Test Suite: Per-operation runAsUserEmail Override
   *
   * Verifies that runAsUserEmail can be overridden on a per-operation basis,
   * allowing different user contexts for individual operations even when a
   * global runAsUserEmail is configured.
   *
   * This functionality is critical for scenarios where:
   * - A service account is configured globally
   * - Individual operations need to run as specific end users
   * - Different permissions are required for different operations
   *
   * Tests also verify that per-operation properties can be merged with
   * global runAsUserEmail configuration without conflict.
   */
  describe('Per-operation runAsUserEmail override', () => {
    /**
     * Test: Per-operation Override of Global runAsUserEmail
     *
     * Verifies that a per-operation runAsUserEmail specified in the properties
     * parameter takes precedence over the global configuration.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='global@example.com'
     * 2. Execute operation with properties.RunAsUserEmail='override@example.com'
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail equals override value, not global value
     *
     * Expected behavior:
     * - Per-operation RunAsUserEmail overrides global configuration
     * - Properties.RunAsUserEmail equals 'override@example.com' (not 'global@example.com')
     * - Global setting remains unchanged for subsequent operations
     *
     * Use case: Service configured with service account email globally, but
     * specific operations need to run as the actual end user for permissions
     * or audit trail purposes.
     */
    it('should allow per-operation override of global runAsUserEmail', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'global@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123' }] },
      });

      await client.add({
        tableName: 'Users',
        rows: [{ name: 'John' }],
        properties: {
          RunAsUserEmail: 'override@example.com',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'override@example.com',
          }),
        })
      );
    });

    /**
     * Test: Merging Per-operation Properties with Global runAsUserEmail
     *
     * Verifies that when additional properties are specified per-operation,
     * they are correctly merged with the global runAsUserEmail configuration
     * without conflict or data loss.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='global@example.com'
     * 2. Execute find operation with additional properties (Locale, Timezone)
     * 3. Inspect the HTTP POST request payload
     * 4. Verify all properties are present: RunAsUserEmail, Locale, Timezone
     *
     * Expected behavior:
     * - Global RunAsUserEmail is automatically included
     * - Per-operation properties (Locale, Timezone) are added
     * - All properties coexist in the Properties object
     * - No property overwrites or conflicts occur
     *
     * Use case: Operations requiring user context plus additional configuration
     * like localization settings, timezone, or custom AppSheet properties.
     */
    it('should merge per-operation properties with global runAsUserEmail', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'global@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.find({
        tableName: 'Users',
        properties: {
          Locale: 'de-DE',
          Timezone: 'Europe/Berlin',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'global@example.com',
            Locale: 'de-DE',
            Timezone: 'Europe/Berlin',
          }),
        })
      );
    });

    /**
     * Test: Selector and runAsUserEmail Combined in Find Operations
     *
     * Verifies that AppSheet Selector expressions (filtering criteria) can be
     * used together with runAsUserEmail in find operations. Both are passed
     * in the Properties object.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='finder@example.com'
     * 2. Execute find operation with selector='[Status] = "Active"'
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties contains both RunAsUserEmail and Selector
     *
     * Expected behavior:
     * - Properties.RunAsUserEmail equals 'finder@example.com'
     * - Properties.Selector equals '[Status] = "Active"'
     * - Both properties coexist without conflict
     * - Selector uses AppSheet's bracket notation syntax
     *
     * Use case: Querying filtered data with user context, common in
     * permission-based data access where users can only see their own
     * records or records matching certain criteria.
     *
     * Note: Selector is a special property in AppSheet API used for filtering
     * rows in Find operations using AppSheet's expression syntax.
     */
    it('should handle selector and runAsUserEmail together in find operations', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'finder@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.find({
        tableName: 'Users',
        selector: '[Status] = "Active"',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'finder@example.com',
            Selector: '[Status] = "Active"',
          }),
        })
      );
    });
  });

  /**
   * Test Suite: Convenience Methods with runAsUserEmail
   *
   * Verifies that all convenience methods (simplified APIs for common operations)
   * correctly apply the global runAsUserEmail configuration to their HTTP requests.
   *
   * Convenience methods tested:
   * - findAll(tableName): Find all rows in a table
   * - findOne(tableName, selector): Find a single row matching a selector
   * - addOne(tableName, row): Add a single row
   * - updateOne(tableName, row): Update a single row
   * - deleteOne(tableName, row): Delete a single row
   *
   * These methods provide simpler APIs compared to the full add/find/update/delete
   * methods, automatically wrapping single rows in arrays and handling common
   * use cases with less boilerplate code.
   */
  describe('Convenience methods', () => {
    /**
     * Test: findAll() Convenience Method with runAsUserEmail
     *
     * Verifies that the findAll() convenience method correctly applies the
     * global runAsUserEmail configuration to its HTTP requests.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='reader@example.com'
     * 2. Call findAll('Users') convenience method
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Action='Find' and Properties.RunAsUserEmail is present
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Find'
     * - Properties.RunAsUserEmail equals 'reader@example.com'
     * - No Selector is included (findAll retrieves all rows)
     * - Method provides simpler API than full find() method
     *
     * Use case: Retrieving all records in a table with user context,
     * useful for permission-based filtering or audit trails.
     *
     * API comparison:
     * - Convenience: client.findAll('Users')
     * - Full API: client.find({ tableName: 'Users' })
     */
    it('should apply runAsUserEmail to findAll convenience method', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'reader@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '1' }, { id: '2' }] },
      });

      await client.findAll('Users');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Find',
          Properties: expect.objectContaining({
            RunAsUserEmail: 'reader@example.com',
          }),
        })
      );
    });

    /**
     * Test: findOne() Convenience Method with runAsUserEmail
     *
     * Verifies that the findOne() convenience method correctly applies both
     * the global runAsUserEmail and the provided selector to HTTP requests.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='reader@example.com'
     * 2. Call findOne('Users', '[Email] = "john@example.com"')
     * 3. Inspect the HTTP POST request payload
     * 4. Verify both RunAsUserEmail and Selector are in Properties
     *
     * Expected behavior:
     * - Properties.RunAsUserEmail equals 'reader@example.com'
     * - Properties.Selector equals '[Email] = "john@example.com"'
     * - Method returns first matching row or null
     * - Simpler API than find() for single-row queries
     *
     * Use case: Looking up a specific record by email, ID, or other unique
     * identifier with user context for permissions or audit trails.
     *
     * API comparison:
     * - Convenience: client.findOne('Users', '[Email] = "john@example.com"')
     * - Full API: client.find({ tableName: 'Users', selector: '[Email] = "john@example.com"' }).then(r => r[0] || null)
     */
    it('should apply runAsUserEmail to findOne convenience method', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'reader@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123', name: 'John' }] },
      });

      await client.findOne('Users', '[Email] = "john@example.com"');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'reader@example.com',
            Selector: '[Email] = "john@example.com"',
          }),
        })
      );
    });

    /**
     * Test: addOne() Convenience Method with runAsUserEmail
     *
     * Verifies that the addOne() convenience method correctly applies the
     * global runAsUserEmail configuration when creating a single row.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='creator@example.com'
     * 2. Call addOne('Users', { name: 'Jane' })
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Add'
     * - Properties.RunAsUserEmail equals 'creator@example.com'
     * - Single row is wrapped in array automatically
     * - Returns the created row (not array)
     *
     * Use case: Creating a single record with user context for audit trail
     * tracking who created the record.
     *
     * API comparison:
     * - Convenience: client.addOne('Users', { name: 'Jane' })
     * - Full API: client.add({ tableName: 'Users', rows: [{ name: 'Jane' }] }).then(r => r[0])
     */
    it('should apply runAsUserEmail to addOne convenience method', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'creator@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123', name: 'Jane' }] },
      });

      await client.addOne('Users', { name: 'Jane' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'creator@example.com',
          }),
        })
      );
    });

    /**
     * Test: updateOne() Convenience Method with runAsUserEmail
     *
     * Verifies that the updateOne() convenience method correctly applies the
     * global runAsUserEmail configuration when updating a single row.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='updater@example.com'
     * 2. Call updateOne('Users', { id: '123', name: 'Updated' })
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Edit'
     * - Properties.RunAsUserEmail equals 'updater@example.com'
     * - Single row is wrapped in array automatically
     * - Returns the updated row (not array)
     *
     * Use case: Updating a single record with user context for audit trail
     * tracking who modified the record.
     *
     * API comparison:
     * - Convenience: client.updateOne('Users', { id: '123', name: 'Updated' })
     * - Full API: client.update({ tableName: 'Users', rows: [{ id: '123', name: 'Updated' }] }).then(r => r[0])
     */
    it('should apply runAsUserEmail to updateOne convenience method', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'updater@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '123', name: 'Updated' }] },
      });

      await client.updateOne('Users', { id: '123', name: 'Updated' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'updater@example.com',
          }),
        })
      );
    });

    /**
     * Test: deleteOne() Convenience Method with runAsUserEmail
     *
     * Verifies that the deleteOne() convenience method correctly applies the
     * global runAsUserEmail configuration when deleting a single row.
     *
     * Test approach:
     * 1. Create client with global runAsUserEmail='deleter@example.com'
     * 2. Call deleteOne('Users', { id: '123' })
     * 3. Inspect the HTTP POST request payload
     * 4. Verify Properties.RunAsUserEmail is present
     *
     * Expected behavior:
     * - HTTP request contains Action: 'Delete'
     * - Properties.RunAsUserEmail equals 'deleter@example.com'
     * - Single row is wrapped in array automatically
     * - Returns boolean indicating success (true if deleted)
     *
     * Use case: Deleting a single record with user context for audit trail
     * tracking who deleted the record.
     *
     * API comparison:
     * - Convenience: client.deleteOne('Users', { id: '123' })
     * - Full API: client.delete({ tableName: 'Users', rows: [{ id: '123' }] }).then(r => r.success)
     */
    it('should apply runAsUserEmail to deleteOne convenience method', async () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'deleter@example.com',
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.deleteOne('Users', { id: '123' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'deleter@example.com',
          }),
        })
      );
    });
  });

  /**
   * Test Suite: Configuration Retrieval
   *
   * Verifies that the getConfig() method correctly returns the client's
   * configuration including the runAsUserEmail setting if configured.
   *
   * This allows users to:
   * - Inspect the current configuration at runtime
   * - Verify runAsUserEmail is set correctly
   * - Debug configuration issues
   * - Clone or modify configuration for new client instances
   */
  describe('Configuration retrieval', () => {
    /**
     * Test: getConfig() Includes runAsUserEmail When Configured
     *
     * Verifies that the getConfig() method returns the client's configuration
     * including the runAsUserEmail setting when it is configured.
     *
     * Test approach:
     * 1. Create client with runAsUserEmail='test@example.com'
     * 2. Call getConfig() method
     * 3. Verify returned config object includes runAsUserEmail property
     * 4. Verify runAsUserEmail value matches configured value
     *
     * Expected behavior:
     * - getConfig() returns an object with all client configuration
     * - config.runAsUserEmail equals 'test@example.com'
     * - Configuration is readable at runtime
     * - Other config fields (appId, applicationAccessKey) are also present
     *
     * Use case: Inspecting configuration at runtime for debugging, logging,
     * or creating new client instances with modified configuration.
     *
     * Note: The returned config is readonly to prevent accidental modification.
     */
    it('should include runAsUserEmail in getConfig() result', () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'test@example.com',
      });

      const config = client.getConfig();

      expect(config.runAsUserEmail).toBe('test@example.com');
    });

    /**
     * Test: getConfig() Returns Undefined runAsUserEmail When Not Set
     *
     * Verifies that when runAsUserEmail is not configured during client
     * initialization, the getConfig() method returns undefined for this
     * property rather than a default value or empty string.
     *
     * Test approach:
     * 1. Create client without runAsUserEmail configuration
     * 2. Call getConfig() method
     * 3. Verify config.runAsUserEmail is undefined
     *
     * Expected behavior:
     * - getConfig() returns an object with all required configuration
     * - config.runAsUserEmail is undefined (not null, not empty string)
     * - Other config fields (appId, applicationAccessKey) are present
     * - Client functions normally without runAsUserEmail
     *
     * Use case: Clients that don't require user context can omit
     * runAsUserEmail, and this is reflected in getConfig() output.
     *
     * Important: Undefined means the feature is not configured, which is
     * different from an empty string or null value.
     */
    it('should have undefined runAsUserEmail in getConfig() when not set', () => {
      const client = new AppSheetClient(mockConfig);

      const config = client.getConfig();

      expect(config.runAsUserEmail).toBeUndefined();
    });
  });
});
