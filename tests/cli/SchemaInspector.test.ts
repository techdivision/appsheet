/**
 * Tests for SchemaInspector type inference and enum detection
 */

import { SchemaInspector } from '../../src/cli/SchemaInspector';
import { AppSheetClient } from '../../src/client/AppSheetClient';

// Mock AppSheetClient
jest.mock('../../src/client/AppSheetClient');

describe('SchemaInspector', () => {
  let mockClient: jest.Mocked<AppSheetClient>;
  let inspector: SchemaInspector;

  beforeEach(() => {
    mockClient = new AppSheetClient({
      appId: 'test',
      applicationAccessKey: 'test',
    }) as jest.Mocked<AppSheetClient>;

    inspector = new SchemaInspector(mockClient);
  });

  describe('Type inference', () => {
    it('should infer Email type from email addresses', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', email: 'user1@example.com' },
          { id: '2', email: 'user2@example.com' },
          { id: '3', email: 'test@domain.co.uk' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('users');

      expect(result.fields.email).toEqual({
        type: 'Email',
        required: false,
      });
    });

    it('should infer URL type from URLs', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', website: 'https://example.com' },
          { id: '2', website: 'http://localhost:3000' },
          { id: '3', website: 'https://sub.domain.com/path' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('links');

      expect(result.fields.website).toEqual({
        type: 'URL',
        required: false,
      });
    });

    it('should infer Phone type from phone numbers', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', phone: '+1 234 567 8900' },
          { id: '2', phone: '(123) 456-7890' },
          { id: '3', phone: '+49 123 456789' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('contacts');

      expect(result.fields.phone).toEqual({
        type: 'Phone',
        required: false,
      });
    });

    it('should infer Date type from date strings', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '2025-11-20' },
          { id: '2', date: '2024-01-01' },
          { id: '3', date: '2025-12-31' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('events');

      expect(result.fields.date).toEqual({
        type: 'Date',
        required: false,
      });
    });

    it('should infer DateTime type from ISO datetime strings', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', timestamp: '2025-11-20T10:30:00Z' },
          { id: '2', timestamp: '2024-01-01T00:00:00+01:00' },
          { id: '3', timestamp: '2025-12-31T23:59:59Z' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('logs');

      expect(result.fields.timestamp).toEqual({
        type: 'DateTime',
        required: false,
      });
    });

    it('should infer Percent type from decimal values between 0 and 1', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', progress: 0.25 },
          { id: '2', progress: 0.5 },
          { id: '3', progress: 0.75 },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('tasks');

      expect(result.fields.progress).toEqual({
        type: 'Percent',
        required: false,
      });
    });

    it('should infer Number type for other numeric values', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', quantity: 10, price: 99.99 },
          { id: '2', quantity: 5, price: 199.99 },
          { id: '3', quantity: 0, price: 0 },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('products');

      expect(result.fields.quantity.type).toBe('Number');
      expect(result.fields.price.type).toBe('Number');
    });

    it('should infer YesNo type from boolean values', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', active: true },
          { id: '2', active: false },
          { id: '3', active: true },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('settings');

      expect(result.fields.active).toEqual({
        type: 'YesNo',
        required: false,
      });
    });

    it('should infer YesNo type from "Yes"/"No" strings', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', enabled: 'Yes' },
          { id: '2', enabled: 'No' },
          { id: '3', enabled: 'Yes' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('features');

      expect(result.fields.enabled).toEqual({
        type: 'YesNo',
        required: false,
      });
    });

    it('should infer EnumList type from arrays', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', tags: ['Frontend', 'JavaScript'] },
          { id: '2', tags: ['Backend', 'TypeScript'] },
          { id: '3', tags: ['Mobile', 'React'] },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('posts');

      expect(result.fields.tags.type).toBe('EnumList');
      expect(result.fields.tags.allowedValues).toBeDefined();
    });
  });

  describe('Enum detection heuristics', () => {
    it('should detect enum with few unique values (≤10)', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', status: 'Active' },
          { id: '2', status: 'Inactive' },
          { id: '3', status: 'Pending' },
          { id: '4', status: 'Active' },
          { id: '5', status: 'Inactive' },
          { id: '6', status: 'Active' },
          { id: '7', status: 'Pending' },
          { id: '8', status: 'Active' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('users');

      expect(result.fields.status.type).toBe('Enum');
      expect(result.fields.status.allowedValues).toEqual(['Active', 'Inactive', 'Pending']);
    });

    it('should detect enum with low unique ratio (<20%)', async () => {
      // Create 100 rows with only 5 unique values (5% ratio)
      const rows = [];
      const statuses = ['Low', 'Medium', 'High', 'Critical', 'Urgent'];
      for (let i = 0; i < 100; i++) {
        rows.push({ id: `${i}`, priority: statuses[i % 5] });
      }

      mockClient.find.mockResolvedValue({ rows, warnings: [] });

      const result = await inspector.inspectTable('issues');

      expect(result.fields.priority.type).toBe('Enum');
      expect(result.fields.priority.allowedValues).toEqual([
        'Critical',
        'High',
        'Low',
        'Medium',
        'Urgent',
      ]);
    });

    it('should NOT detect enum with high unique ratio (>20%)', async () => {
      // Create 100 rows with 50 unique values (50% ratio) - should not be detected as enum
      const rows = [];
      for (let i = 0; i < 100; i++) {
        rows.push({ id: `${i}`, name: `User ${i % 50}` });
      }

      mockClient.find.mockResolvedValue({ rows, warnings: [] });

      const result = await inspector.inspectTable('users');

      expect(result.fields.name.type).toBe('Text');
      expect(result.fields.name.allowedValues).toBeUndefined();
    });

    it('should extract sorted allowedValues for Enum', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', status: 'Pending' },
          { id: '2', status: 'Active' },
          { id: '3', status: 'Inactive' },
          { id: '4', status: 'Active' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('users');

      expect(result.fields.status.allowedValues).toEqual(['Active', 'Inactive', 'Pending']);
    });

    it('should extract sorted allowedValues for EnumList', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', tags: ['JavaScript', 'TypeScript'] },
          { id: '2', tags: ['Python', 'JavaScript'] },
          { id: '3', tags: ['TypeScript', 'React'] },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('posts');

      expect(result.fields.tags.allowedValues).toEqual([
        'JavaScript',
        'Python',
        'React',
        'TypeScript',
      ]);
    });
  });

  describe('Multi-row analysis', () => {
    it('should analyze up to 100 rows for type inference', async () => {
      // Create 150 rows - inspector should only analyze first 100
      const rows = [];
      for (let i = 0; i < 150; i++) {
        rows.push({ id: `${i}`, email: `user${i}@example.com` });
      }

      mockClient.find.mockResolvedValue({ rows, warnings: [] });

      await inspector.inspectTable('users');

      // Verify find was called without limit (gets all rows)
      expect(mockClient.find).toHaveBeenCalledWith({ tableName: 'users' });
    });

    it('should prefer first non-null value for type inference', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', email: null },
          { id: '2', email: undefined },
          { id: '3', email: 'user@example.com' },
          { id: '4', email: 'another@example.com' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('users');

      expect(result.fields.email.type).toBe('Email');
    });

    it('should default to Text type when all values are null', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', description: null },
          { id: '2', description: null },
          { id: '3', description: undefined },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('items');

      expect(result.fields.description.type).toBe('Text');
    });
  });

  describe('Key field detection', () => {
    it('should detect "id" as key field', async () => {
      mockClient.find.mockResolvedValue({
        rows: [{ id: '1', name: 'Test' }],
        warnings: [],
      });

      const result = await inspector.inspectTable('users');

      expect(result.keyField).toBe('id');
    });

    it('should detect "_RowNumber" as key field', async () => {
      mockClient.find.mockResolvedValue({
        rows: [{ _RowNumber: '1', name: 'Test' }],
        warnings: [],
      });

      const result = await inspector.inspectTable('items');

      expect(result.keyField).toBe('_RowNumber');
    });

    it('should detect "Key" as key field', async () => {
      mockClient.find.mockResolvedValue({
        rows: [{ Key: '1', name: 'Test' }],
        warnings: [],
      });

      const result = await inspector.inspectTable('records');

      expect(result.keyField).toBe('Key');
    });

    it('should fallback to first field if no common key found', async () => {
      mockClient.find.mockResolvedValue({
        rows: [{ custom_pk: '1', name: 'Test' }],
        warnings: [],
      });

      const result = await inspector.inspectTable('custom');

      expect(result.keyField).toBe('custom_pk');
    });
  });

  describe('Empty table handling', () => {
    it('should handle empty table', async () => {
      mockClient.find.mockResolvedValue({ rows: [], warnings: [] });

      const result = await inspector.inspectTable('empty_table');

      expect(result.fields).toEqual({});
      expect(result.warning).toBe('Table is empty, could not infer field types');
      expect(result.keyField).toBe('id'); // Default
    });
  });

  describe('Schema name conversion', () => {
    it('should remove "extract_" prefix and add "s" suffix', () => {
      expect(inspector.toSchemaName('extract_user')).toBe('users');
      expect(inspector.toSchemaName('extract_worklog')).toBe('worklogs');
    });

    it('should remove underscores and add "s" suffix', () => {
      expect(inspector.toSchemaName('work_log')).toBe('worklogs');
      expect(inspector.toSchemaName('user_profile')).toBe('userprofiles');
    });

    it('should handle simple table names', () => {
      expect(inspector.toSchemaName('user')).toBe('users');
      expect(inspector.toSchemaName('item')).toBe('items');
    });
  });

  describe('Error handling', () => {
    it('should throw error with table name when inspection fails', async () => {
      mockClient.find.mockRejectedValue(new Error('API error'));

      await expect(inspector.inspectTable('users')).rejects.toThrow(
        'Failed to inspect table "users": API error'
      );
    });
  });

  describe('generateSchema', () => {
    it('should generate schema for multiple tables', async () => {
      // Mock responses for two tables
      mockClient.find
        .mockResolvedValueOnce({
          rows: [{ id: '1', email: 'user@example.com', name: 'User 1' }],
          warnings: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: '1', date: '2025-11-20', hours: 8, description: 'Work' }],
          warnings: [],
        });

      // Suppress console.log during test
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const schema = await inspector.generateSchema('default', ['extract_user', 'extract_worklog']);

      expect(schema.appId).toBe('${APPSHEET_APP_ID}');
      expect(schema.applicationAccessKey).toBe('${APPSHEET_ACCESS_KEY}');
      expect(Object.keys(schema.tables)).toEqual(['users', 'worklogs']);

      expect(schema.tables.users.tableName).toBe('extract_user');
      expect(schema.tables.users.fields.email.type).toBe('Email');

      expect(schema.tables.worklogs.tableName).toBe('extract_worklog');
      expect(schema.tables.worklogs.fields.date.type).toBe('Date');
      expect(schema.tables.worklogs.fields.hours.type).toBe('Number');

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Mixed type scenarios', () => {
    it('should handle table with all field types', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          {
            id: '1',
            name: 'Project Alpha',
            email: 'contact@alpha.com',
            website: 'https://alpha.com',
            phone: '+1234567890',
            status: 'Active',
            tags: ['Frontend', 'Backend'],
            progress: 0.35,
            startDate: '2025-01-01',
            lastUpdate: '2025-11-20T10:30:00Z',
            budget: 50000,
            active: true,
          },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('projects');

      expect(result.fields.name.type).toBe('Text');
      expect(result.fields.email.type).toBe('Email');
      expect(result.fields.website.type).toBe('URL');
      expect(result.fields.phone.type).toBe('Phone');
      expect(result.fields.status.type).toBe('Text'); // Only 1 value, can't detect enum
      expect(result.fields.tags.type).toBe('EnumList');
      expect(result.fields.progress.type).toBe('Percent');
      expect(result.fields.startDate.type).toBe('Date');
      expect(result.fields.lastUpdate.type).toBe('DateTime');
      expect(result.fields.budget.type).toBe('Number');
      expect(result.fields.active.type).toBe('YesNo');
    });
  });
});
