/**
 * Test Suite: AppSheetClient v3.0.0 - New Constructor and getTable() Method
 *
 * Tests for the v3.0.0 breaking changes:
 * - New constructor signature: (connectionDef: ConnectionDefinition, runAsUserEmail: string)
 * - New getTable() method for accessing table definitions
 *
 * @module tests/client
 */

import axios from 'axios';
import { AppSheetClient } from '../../src/client/AppSheetClient';
import { ConnectionDefinition } from '../../src/types';

/**
 * Mock axios module to intercept HTTP requests without hitting real API.
 */
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppSheetClient v3.0.0', () => {
  /**
   * Sample ConnectionDefinition for testing.
   * Contains full configuration including tables.
   */
  const mockConnectionDef: ConnectionDefinition = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
    tables: {
      users: {
        tableName: 'extract_user',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          name: { type: 'Name', required: false },
        },
      },
      worklogs: {
        tableName: 'extract_worklog',
        keyField: 'worklog_id',
        fields: {
          worklog_id: { type: 'Text', required: true },
          date: { type: 'Date', required: true },
          hours: { type: 'Number', required: true },
        },
      },
    },
  };

  const mockRunAsUserEmail = 'user@example.com';

  /**
   * Mocked axios instance that captures HTTP POST requests.
   */
  const mockAxiosInstance = {
    post: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  describe('Constructor', () => {
    /**
     * Test: Constructor accepts ConnectionDefinition and runAsUserEmail
     */
    it('should accept ConnectionDefinition and runAsUserEmail', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      expect(client).toBeInstanceOf(AppSheetClient);
    });

    /**
     * Test: Constructor uses appId from ConnectionDefinition for API calls
     */
    it('should use appId from ConnectionDefinition for API calls', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.findAll('extract_user');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('test-app-id'),
        expect.any(Object)
      );
    });

    /**
     * Test: Constructor uses runAsUserEmail for all operations
     */
    it('should use runAsUserEmail for all operations', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      await client.findAll('extract_user');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Properties: expect.objectContaining({
            RunAsUserEmail: 'user@example.com',
          }),
        })
      );
    });

    /**
     * Test: Constructor applies optional settings from ConnectionDefinition
     */
    it('should apply optional settings from ConnectionDefinition', () => {
      const connDefWithOptions: ConnectionDefinition = {
        ...mockConnectionDef,
        baseUrl: 'https://custom.api.com',
        timeout: 60000,
      };

      // Create client to trigger axios.create
      new AppSheetClient(connDefWithOptions, mockRunAsUserEmail);

      // Verify axios was created with custom settings
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom.api.com',
          timeout: 60000,
        })
      );
    });
  });

  describe('getTable() method', () => {
    /**
     * Test: getTable() returns TableDefinition for existing table
     */
    it('should return TableDefinition for existing table', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      const tableDef = client.getTable('users');

      expect(tableDef).toEqual({
        tableName: 'extract_user',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          name: { type: 'Name', required: false },
        },
      });
    });

    /**
     * Test: getTable() returns correct TableDefinition for different tables
     */
    it('should return correct TableDefinition for different tables', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      const usersDef = client.getTable('users');
      const worklogsDef = client.getTable('worklogs');

      expect(usersDef.tableName).toBe('extract_user');
      expect(usersDef.keyField).toBe('id');

      expect(worklogsDef.tableName).toBe('extract_worklog');
      expect(worklogsDef.keyField).toBe('worklog_id');
    });

    /**
     * Test: getTable() throws Error for non-existent table
     */
    it('should throw Error for non-existent table', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      expect(() => client.getTable('nonexistent')).toThrow(
        'Table "nonexistent" not found. Available tables: users, worklogs'
      );
    });

    /**
     * Test: getTable() error message lists available tables
     */
    it('should list available tables in error message', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      expect(() => client.getTable('invalid')).toThrow(/Available tables:/);
      expect(() => client.getTable('invalid')).toThrow(/users/);
      expect(() => client.getTable('invalid')).toThrow(/worklogs/);
    });

    /**
     * Test: getTable() handles empty tables object
     */
    it('should handle empty tables object gracefully', () => {
      const emptyConnDef: ConnectionDefinition = {
        appId: 'test-app',
        applicationAccessKey: 'test-key',
        tables: {},
      };

      const client = new AppSheetClient(emptyConnDef, mockRunAsUserEmail);

      expect(() => client.getTable('anything')).toThrow(
        'Table "anything" not found. Available tables: none'
      );
    });
  });

  describe('CRUD operations with new constructor', () => {
    /**
     * Test: findAll still works with new constructor
     */
    it('should perform findAll with ConnectionDefinition', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '1', email: 'test@example.com' }] },
      });

      const result = await client.findAll('extract_user');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', email: 'test@example.com' });
    });

    /**
     * Test: add still works with new constructor
     */
    it('should perform add with ConnectionDefinition', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '1', email: 'new@example.com' }] },
      });

      const result = await client.add({
        tableName: 'extract_user',
        rows: [{ email: 'new@example.com' }],
      });

      expect(result.rows).toHaveLength(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Add',
          Properties: expect.objectContaining({
            RunAsUserEmail: 'user@example.com',
          }),
        })
      );
    });

    /**
     * Test: update still works with new constructor
     */
    it('should perform update with ConnectionDefinition', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [{ id: '1', email: 'updated@example.com' }] },
      });

      const result = await client.update({
        tableName: 'extract_user',
        rows: [{ id: '1', email: 'updated@example.com' }],
      });

      expect(result.rows).toHaveLength(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Action: 'Edit',
        })
      );
    });

    /**
     * Test: delete still works with new constructor
     */
    it('should perform delete with ConnectionDefinition', async () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      mockAxiosInstance.post.mockResolvedValue({
        data: { Rows: [] },
      });

      const result = await client.delete({
        tableName: 'extract_user',
        rows: [{ id: '1' }],
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
    });
  });

  describe('AppSheetClientInterface compliance', () => {
    /**
     * Test: Client implements all required interface methods
     */
    it('should implement all AppSheetClientInterface methods', () => {
      const client = new AppSheetClient(mockConnectionDef, mockRunAsUserEmail);

      // Core CRUD methods
      expect(typeof client.add).toBe('function');
      expect(typeof client.find).toBe('function');
      expect(typeof client.update).toBe('function');
      expect(typeof client.delete).toBe('function');

      // Convenience methods
      expect(typeof client.findAll).toBe('function');
      expect(typeof client.findOne).toBe('function');
      expect(typeof client.addOne).toBe('function');
      expect(typeof client.updateOne).toBe('function');
      expect(typeof client.deleteOne).toBe('function');

      // New v3.0.0 method
      expect(typeof client.getTable).toBe('function');
    });
  });
});
