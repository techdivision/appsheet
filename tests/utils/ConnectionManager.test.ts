/**
 * Test Suite: ConnectionManager - User-Specific Client Creation
 *
 * Test suite for ConnectionManager class that verifies the new per-request
 * user context feature (runAsUserEmail parameter on get() method).
 *
 * Test areas:
 * - Default client retrieval (backward compatible)
 * - User-specific client creation (new feature)
 * - Client configuration verification
 * - Error handling for invalid connections
 * - Multiple connection management
 *
 * @module tests/utils
 */

import { ConnectionManager } from '../../src/utils/ConnectionManager';
import { AppSheetClient } from '../../src/client/AppSheetClient';

/**
 * Mock axios module to prevent actual HTTP requests during tests.
 * ConnectionManager creates AppSheetClient instances which use axios internally.
 */
jest.mock('axios');

/**
 * Test Suite: ConnectionManager - runAsUserEmail Feature
 *
 * Tests the ConnectionManager's ability to create user-specific clients
 * on-the-fly when the optional runAsUserEmail parameter is provided.
 */
describe('ConnectionManager - runAsUserEmail', () => {
  /**
   * Base configuration for creating test connections.
   * Uses minimal config with only required fields.
   */
  const baseConfig = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
  };

  let manager: ConnectionManager;

  /**
   * Setup: Create a fresh ConnectionManager instance before each test.
   * Ensures test isolation and clean state.
   */
  beforeEach(() => {
    manager = new ConnectionManager();
  });

  /**
   * Test Suite: Default Client Retrieval (Backward Compatible)
   *
   * Verifies that when no runAsUserEmail parameter is provided,
   * the get() method returns the default registered client.
   *
   * This ensures 100% backward compatibility with existing code
   * that doesn't use the user-specific feature.
   */
  describe('Default client retrieval (backward compatible)', () => {
    /**
     * Test: Return Default Client Without User Parameter
     *
     * Verifies that calling get() without runAsUserEmail parameter
     * returns the same client instance that was registered.
     *
     * Test approach:
     * 1. Register a connection with default config
     * 2. Call get() without runAsUserEmail parameter
     * 3. Verify returned client is an AppSheetClient instance
     *
     * Expected behavior:
     * - Returns a valid AppSheetClient
     * - Uses default configuration from registration
     * - No user-specific configuration applied
     */
    it('should return default client when no runAsUserEmail is provided', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const client = manager.get('test-conn');

      expect(client).toBeInstanceOf(AppSheetClient);
      expect(client.getConfig().appId).toBe(baseConfig.appId);
      expect(client.getConfig().applicationAccessKey).toBe(baseConfig.applicationAccessKey);
    });

    /**
     * Test: Return Default Client With Global runAsUserEmail
     *
     * Verifies that when a connection is registered with a global
     * runAsUserEmail, calling get() without parameter returns a client
     * configured with that global user.
     *
     * Test approach:
     * 1. Register connection with global runAsUserEmail
     * 2. Call get() without runAsUserEmail parameter
     * 3. Verify client has global runAsUserEmail configured
     *
     * Expected behavior:
     * - Returns client with global runAsUserEmail from registration
     * - Global runAsUserEmail is set in client config
     */
    it('should return default client with global runAsUserEmail when configured', () => {
      const globalEmail = 'global@example.com';
      manager.register({
        name: 'test-conn',
        ...baseConfig,
        runAsUserEmail: globalEmail,
      });

      const client = manager.get('test-conn');

      expect(client).toBeInstanceOf(AppSheetClient);
      expect(client.getConfig().runAsUserEmail).toBe(globalEmail);
    });

    /**
     * Test: Return Same Instance on Multiple Calls
     *
     * Verifies that calling get() multiple times without runAsUserEmail
     * returns the same client instance (cached behavior).
     *
     * Test approach:
     * 1. Register a connection
     * 2. Call get() twice without runAsUserEmail
     * 3. Verify both calls return the exact same instance
     *
     * Expected behavior:
     * - Multiple calls return same instance (reference equality)
     * - Default client is cached and reused
     */
    it('should return same instance on multiple calls without runAsUserEmail', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const client1 = manager.get('test-conn');
      const client2 = manager.get('test-conn');

      expect(client1).toBe(client2); // Reference equality
    });
  });

  /**
   * Test Suite: User-Specific Client Creation
   *
   * Verifies the new feature where providing runAsUserEmail parameter
   * creates a new client instance with user-specific configuration.
   *
   * This is the core feature for per-request user context support
   * in multi-tenant MCP servers.
   */
  describe('User-specific client creation', () => {
    /**
     * Test: Create User-Specific Client On-The-Fly
     *
     * Verifies that providing runAsUserEmail creates a new client
     * with user-specific configuration.
     *
     * Test approach:
     * 1. Register connection without global user
     * 2. Call get() with runAsUserEmail parameter
     * 3. Verify new client has user-specific runAsUserEmail
     *
     * Expected behavior:
     * - Returns new AppSheetClient instance
     * - Client has user-specific runAsUserEmail configured
     * - Base config (appId, key) inherited from registered connection
     */
    it('should create user-specific client when runAsUserEmail is provided', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const userEmail = 'user@example.com';
      const client = manager.get('test-conn', userEmail);

      expect(client).toBeInstanceOf(AppSheetClient);
      expect(client.getConfig().runAsUserEmail).toBe(userEmail);
      expect(client.getConfig().appId).toBe(baseConfig.appId);
      expect(client.getConfig().applicationAccessKey).toBe(baseConfig.applicationAccessKey);
    });

    /**
     * Test: User-Specific Client Overrides Global Config
     *
     * Verifies that when connection has global runAsUserEmail configured,
     * providing a different runAsUserEmail parameter creates a client
     * with the parameter value (override behavior).
     *
     * Test approach:
     * 1. Register connection with global runAsUserEmail
     * 2. Call get() with different runAsUserEmail
     * 3. Verify new client uses parameter value, not global value
     *
     * Expected behavior:
     * - Parameter runAsUserEmail overrides global config
     * - New client uses provided user email
     * - Global config remains unchanged
     */
    it('should override global runAsUserEmail with parameter value', () => {
      const globalEmail = 'global@example.com';
      const userEmail = 'user@example.com';

      manager.register({
        name: 'test-conn',
        ...baseConfig,
        runAsUserEmail: globalEmail,
      });

      const client = manager.get('test-conn', userEmail);

      expect(client.getConfig().runAsUserEmail).toBe(userEmail);
      expect(client.getConfig().runAsUserEmail).not.toBe(globalEmail);
    });

    /**
     * Test: Create New Instance on Each Call with User
     *
     * Verifies that each call to get() with runAsUserEmail creates
     * a new client instance (no caching for user-specific clients).
     *
     * Test approach:
     * 1. Register connection
     * 2. Call get() twice with same runAsUserEmail
     * 3. Verify different instances are returned
     *
     * Expected behavior:
     * - Each call creates new instance (no reference equality)
     * - User-specific clients are not cached
     * - Lightweight operation (AppSheetClient is lightweight)
     */
    it('should create new instance on each call with runAsUserEmail', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const userEmail = 'user@example.com';
      const client1 = manager.get('test-conn', userEmail);
      const client2 = manager.get('test-conn', userEmail);

      expect(client1).not.toBe(client2); // Different instances
      expect(client1.getConfig().runAsUserEmail).toBe(userEmail);
      expect(client2.getConfig().runAsUserEmail).toBe(userEmail);
    });

    /**
     * Test: Create Clients for Different Users
     *
     * Verifies that calling get() with different runAsUserEmail values
     * creates separate clients with correct user configurations.
     *
     * Test approach:
     * 1. Register connection
     * 2. Call get() with different user emails
     * 3. Verify each client has correct user email
     *
     * Expected behavior:
     * - Different clients for different users
     * - Each client has correct runAsUserEmail
     * - All clients share base configuration
     */
    it('should create separate clients for different users', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const user1Email = 'user1@example.com';
      const user2Email = 'user2@example.com';

      const client1 = manager.get('test-conn', user1Email);
      const client2 = manager.get('test-conn', user2Email);

      expect(client1).not.toBe(client2);
      expect(client1.getConfig().runAsUserEmail).toBe(user1Email);
      expect(client2.getConfig().runAsUserEmail).toBe(user2Email);
      expect(client1.getConfig().appId).toBe(baseConfig.appId);
      expect(client2.getConfig().appId).toBe(baseConfig.appId);
    });

    /**
     * Test: User-Specific Client Inherits All Config
     *
     * Verifies that user-specific client inherits all configuration
     * options (baseUrl, timeout, retryAttempts) from registered connection.
     *
     * Test approach:
     * 1. Register connection with custom timeout and retryAttempts
     * 2. Call get() with runAsUserEmail
     * 3. Verify new client has all custom config options
     *
     * Expected behavior:
     * - User-specific client inherits all config options
     * - Only runAsUserEmail is overridden
     * - Custom settings (timeout, retryAttempts) preserved
     */
    it('should inherit all config options in user-specific client', () => {
      const customConfig = {
        name: 'test-conn',
        ...baseConfig,
        timeout: 60000,
        retryAttempts: 5,
        baseUrl: 'https://custom-api.appsheet.com',
      };

      manager.register(customConfig);

      const userEmail = 'user@example.com';
      const client = manager.get('test-conn', userEmail);

      const config = client.getConfig();
      expect(config.runAsUserEmail).toBe(userEmail);
      expect(config.timeout).toBe(customConfig.timeout);
      expect(config.retryAttempts).toBe(customConfig.retryAttempts);
      expect(config.baseUrl).toBe(customConfig.baseUrl);
    });
  });

  /**
   * Test Suite: Error Handling
   *
   * Verifies that ConnectionManager handles errors correctly when
   * requesting non-existent connections or using invalid parameters.
   */
  describe('Error handling', () => {
    /**
     * Test: Throw Error for Non-Existent Connection
     *
     * Verifies that get() throws descriptive error when requesting
     * a connection that hasn't been registered.
     *
     * Test approach:
     * 1. Register some connections
     * 2. Call get() with non-existent connection name
     * 3. Verify error message lists available connections
     *
     * Expected behavior:
     * - Throws Error with descriptive message
     * - Error message includes connection name
     * - Error message lists available connections
     */
    it('should throw error when connection not found', () => {
      manager.register({
        name: 'conn1',
        ...baseConfig,
      });

      expect(() => manager.get('non-existent')).toThrow(
        'Connection "non-existent" not found. Available connections: conn1'
      );
    });

    /**
     * Test: Throw Error When No Connections Registered
     *
     * Verifies error message when get() is called but no connections
     * have been registered yet.
     *
     * Expected behavior:
     * - Throws Error indicating no connections available
     * - Message shows "none" as available connections
     */
    it('should throw error with "none" when no connections registered', () => {
      expect(() => manager.get('any')).toThrow(
        'Connection "any" not found. Available connections: none'
      );
    });

    /**
     * Test: Error for Non-Existent Connection with User Parameter
     *
     * Verifies that error handling works correctly even when
     * runAsUserEmail parameter is provided.
     *
     * Expected behavior:
     * - Throws same error regardless of user parameter
     * - Connection validation happens before user-specific client creation
     */
    it('should throw error for non-existent connection even with runAsUserEmail', () => {
      manager.register({
        name: 'conn1',
        ...baseConfig,
      });

      expect(() => manager.get('non-existent', 'user@example.com')).toThrow(
        'Connection "non-existent" not found'
      );
    });
  });

  /**
   * Test Suite: Multiple Connection Management
   *
   * Verifies that ConnectionManager correctly handles multiple
   * registered connections with user-specific client creation.
   */
  describe('Multiple connection management', () => {
    /**
     * Test: Manage Multiple Connections with User Clients
     *
     * Verifies that user-specific clients can be created for
     * different connections independently.
     *
     * Test approach:
     * 1. Register multiple connections
     * 2. Create user-specific clients for different connections
     * 3. Verify each client has correct connection config and user
     *
     * Expected behavior:
     * - Each connection creates independent clients
     * - User email applied to correct connection
     * - No cross-connection configuration leakage
     */
    it('should manage user-specific clients for multiple connections', () => {
      manager.register({
        name: 'conn1',
        appId: 'app-1',
        applicationAccessKey: 'key-1',
      });

      manager.register({
        name: 'conn2',
        appId: 'app-2',
        applicationAccessKey: 'key-2',
      });

      const userEmail = 'user@example.com';
      const client1 = manager.get('conn1', userEmail);
      const client2 = manager.get('conn2', userEmail);

      expect(client1.getConfig().appId).toBe('app-1');
      expect(client1.getConfig().runAsUserEmail).toBe(userEmail);
      expect(client2.getConfig().appId).toBe('app-2');
      expect(client2.getConfig().runAsUserEmail).toBe(userEmail);
    });

    /**
     * Test: Mix Default and User-Specific Clients
     *
     * Verifies that default and user-specific clients can be
     * retrieved from the same connection without conflicts.
     *
     * Test approach:
     * 1. Register connection
     * 2. Get default client (no user)
     * 3. Get user-specific client (with user)
     * 4. Verify both clients work independently
     *
     * Expected behavior:
     * - Default client has no user or global user
     * - User-specific client has correct user
     * - Both clients are valid and independent
     */
    it('should support mixing default and user-specific clients', () => {
      manager.register({
        name: 'test-conn',
        ...baseConfig,
      });

      const defaultClient = manager.get('test-conn');
      const userClient = manager.get('test-conn', 'user@example.com');

      expect(defaultClient.getConfig().runAsUserEmail).toBeUndefined();
      expect(userClient.getConfig().runAsUserEmail).toBe('user@example.com');
      expect(defaultClient).not.toBe(userClient);
    });
  });
});
