/**
 * Tests for AppSheetClient with runAsUserEmail functionality
 */

import axios from 'axios';
import { AppSheetClient } from './AppSheetClient';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppSheetClient - runAsUserEmail', () => {
  const mockConfig = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
  };

  const mockAxiosInstance = {
    post: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  describe('Global runAsUserEmail configuration', () => {
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

  describe('Per-operation runAsUserEmail override', () => {
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

  describe('Convenience methods', () => {
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

  describe('Configuration retrieval', () => {
    it('should include runAsUserEmail in getConfig() result', () => {
      const client = new AppSheetClient({
        ...mockConfig,
        runAsUserEmail: 'test@example.com',
      });

      const config = client.getConfig();

      expect(config.runAsUserEmail).toBe('test@example.com');
    });

    it('should have undefined runAsUserEmail in getConfig() when not set', () => {
      const client = new AppSheetClient(mockConfig);

      const config = client.getConfig();

      expect(config.runAsUserEmail).toBeUndefined();
    });
  });
});
