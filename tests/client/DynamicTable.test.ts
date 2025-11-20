/**
 * Tests for DynamicTable with AppSheet field types
 */

import { DynamicTable } from '../../src/client/DynamicTable';
import { AppSheetClient } from '../../src/client/AppSheetClient';
import { TableDefinition, ValidationError } from '../../src/types';

// Mock AppSheetClient
jest.mock('../../src/client/AppSheetClient');

describe('DynamicTable - AppSheet Field Types', () => {
  let mockClient: jest.Mocked<AppSheetClient>;
  let tableDef: TableDefinition;

  beforeEach(() => {
    mockClient = new AppSheetClient({
      appId: 'test',
      applicationAccessKey: 'test',
    }) as jest.Mocked<AppSheetClient>;

    // Mock successful responses
    mockClient.add.mockResolvedValue({ rows: [], warnings: [] });
    mockClient.update.mockResolvedValue({ rows: [], warnings: [] });
  });

  describe('Email field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
        },
      };
    });

    it('should accept valid email addresses', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', email: 'user@example.com' },
          { id: '2', email: 'test.user+tag@domain.co.uk' },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject invalid email addresses', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', email: 'invalid-email' }])).rejects.toThrow(
        ValidationError
      );

      await expect(table.add([{ id: '1', email: '@example.com' }])).rejects.toThrow(
        ValidationError
      );

      await expect(table.add([{ id: '1', email: 'user@' }])).rejects.toThrow(ValidationError);
    });

    it('should include field name in error message', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      try {
        await table.add([{ id: '1', email: 'invalid' }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('email');
        expect(error.message).toContain('valid email address');
      }
    });
  });

  describe('URL field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'links',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          website: { type: 'URL', required: false },
        },
      };
    });

    it('should accept valid URLs', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', website: 'https://example.com' },
          { id: '2', website: 'http://localhost:3000/path' },
          { id: '3', website: 'https://sub.domain.com/path?query=1' },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject invalid URLs', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', website: 'not-a-url' }])).rejects.toThrow(
        ValidationError
      );

      await expect(table.add([{ id: '1', website: 'example.com' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Phone field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'contacts',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          phone: { type: 'Phone', required: false },
        },
      };
    });

    it('should accept valid phone numbers', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', phone: '+1 234 567 8900' },
          { id: '2', phone: '(123) 456-7890' },
          { id: '3', phone: '+49 123 456789' },
          { id: '4', phone: '1234567890' },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject invalid phone numbers', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', phone: 'abc123' }])).rejects.toThrow(ValidationError);

      await expect(table.add([{ id: '1', phone: 'invalid phone!' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Enum field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          status: {
            type: 'Enum',
            required: true,
            allowedValues: ['Active', 'Inactive', 'Pending'],
          },
        },
      };
    });

    it('should accept valid enum values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', status: 'Active' },
          { id: '2', status: 'Inactive' },
          { id: '3', status: 'Pending' },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject invalid enum values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', status: 'Unknown' }])).rejects.toThrow(ValidationError);

      await expect(table.add([{ id: '1', status: 'active' }])).rejects.toThrow(
        ValidationError
      ); // Case sensitive
    });

    it('should include allowed values in error message', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      try {
        await table.add([{ id: '1', status: 'Invalid' }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Active, Inactive, Pending');
        expect(error.message).toContain('Invalid');
      }
    });
  });

  describe('EnumList field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'posts',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          tags: {
            type: 'EnumList',
            required: false,
            allowedValues: ['JavaScript', 'TypeScript', 'Node.js', 'React'],
          },
        },
      };
    });

    it('should accept valid enum list values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', tags: ['JavaScript', 'TypeScript'] },
          { id: '2', tags: ['Node.js'] },
          { id: '3', tags: ['React', 'TypeScript', 'JavaScript'] },
        ])
      ).resolves.not.toThrow();
    });

    it('should accept empty arrays', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', tags: [] }])).resolves.not.toThrow();
    });

    it('should reject arrays with invalid values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', tags: ['JavaScript', 'Python'] }])).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject non-array values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', tags: 'JavaScript' as any }])).rejects.toThrow(
        ValidationError
      );
    });

    it('should include invalid values in error message', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      try {
        await table.add([{ id: '1', tags: ['JavaScript', 'Python', 'Ruby'] }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Python');
        expect(error.message).toContain('Ruby');
        expect(error.message).toContain('invalid values');
      }
    });
  });

  describe('Percent field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'discounts',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          rate: { type: 'Percent', required: true },
        },
      };
    });

    it('should accept valid percentage values (0.00 to 1.00)', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', rate: 0.0 },
          { id: '2', rate: 0.5 },
          { id: '3', rate: 1.0 },
          { id: '4', rate: 0.25 },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject values outside 0.00-1.00 range', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', rate: -0.1 }])).rejects.toThrow(ValidationError);

      await expect(table.add([{ id: '1', rate: 1.5 }])).rejects.toThrow(ValidationError);

      await expect(table.add([{ id: '1', rate: 100 }])).rejects.toThrow(ValidationError);
    });

    it('should reject non-numeric values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', rate: '0.5' as any }])).rejects.toThrow(ValidationError);
    });
  });

  describe('Date field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'events',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          eventDate: { type: 'Date', required: true },
        },
      };
    });

    it('should accept valid date strings (YYYY-MM-DD)', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', eventDate: '2025-11-20' },
          { id: '2', eventDate: '2024-01-01' },
        ])
      ).resolves.not.toThrow();
    });

    it('should accept Date objects', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', eventDate: new Date('2025-11-20') }])).resolves.not.toThrow();
    });

    it('should reject invalid date formats', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', eventDate: '11/20/2025' }])).rejects.toThrow(
        ValidationError
      );

      await expect(table.add([{ id: '1', eventDate: '2025-11-20T10:00:00Z' }])).rejects.toThrow(
        ValidationError
      ); // Should use DateTime type
    });
  });

  describe('DateTime field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'logs',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          timestamp: { type: 'DateTime', required: true },
        },
      };
    });

    it('should accept valid datetime strings (ISO 8601)', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', timestamp: '2025-11-20T10:30:00Z' },
          { id: '2', timestamp: '2024-01-01T00:00:00+01:00' },
        ])
      ).resolves.not.toThrow();
    });

    it('should accept Date objects', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([{ id: '1', timestamp: new Date('2025-11-20T10:30:00Z') }])
      ).resolves.not.toThrow();
    });

    it('should reject date-only strings', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', timestamp: '2025-11-20' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('YesNo field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'settings',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          enabled: { type: 'YesNo', required: true },
        },
      };
    });

    it('should accept boolean values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', enabled: true },
          { id: '2', enabled: false },
        ])
      ).resolves.not.toThrow();
    });

    it('should accept "Yes"/"No" strings', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', enabled: 'Yes' },
          { id: '2', enabled: 'No' },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject other string values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', enabled: 'true' as any }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Number types validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'products',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          quantity: { type: 'Number', required: true },
          price: { type: 'Price', required: true },
          discount: { type: 'Decimal', required: false },
        },
      };
    });

    it('should accept numeric values for Number, Price, Decimal', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(
        table.add([
          { id: '1', quantity: 10, price: 99.99, discount: 0.15 },
          { id: '2', quantity: 0, price: 0.0, discount: 0 },
        ])
      ).resolves.not.toThrow();
    });

    it('should reject non-numeric values', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', quantity: '10' as any, price: 99.99 }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Required field validation', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          name: { type: 'Text', required: false },
        },
      };
    });

    it('should reject missing required fields on add', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1' } as any])).rejects.toThrow(ValidationError);
    });

    it('should accept missing optional fields', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.add([{ id: '1', email: 'user@example.com' }])).resolves.not.toThrow();
    });

    it('should not check required fields on update', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      // Only updating name, not providing email (required field)
      await expect(table.update([{ id: '1', name: 'John' }])).resolves.not.toThrow();
    });
  });

  describe('Update operations', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          status: {
            type: 'Enum',
            required: true,
            allowedValues: ['Active', 'Inactive'],
          },
        },
      };
    });

    it('should validate provided fields on update', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      // Valid email update
      await expect(
        table.update([{ id: '1', email: 'newemail@example.com' }])
      ).resolves.not.toThrow();

      // Invalid email update
      await expect(table.update([{ id: '1', email: 'invalid' }])).rejects.toThrow(ValidationError);
    });

    it('should validate enum values on update', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await expect(table.update([{ id: '1', status: 'Active' }])).resolves.not.toThrow();

      await expect(table.update([{ id: '1', status: 'Unknown' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Query methods', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          name: { type: 'Text', required: false },
        },
      };
    });

    it('should find all rows', async () => {
      const mockRows = [
        { id: '1', email: 'user1@example.com', name: 'User 1' },
        { id: '2', email: 'user2@example.com', name: 'User 2' },
      ];
      mockClient.find.mockResolvedValue({ rows: mockRows, warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.findAll();

      expect(result).toEqual(mockRows);
      expect(mockClient.find).toHaveBeenCalledWith({ tableName: 'users' });
    });

    it('should find one row with selector', async () => {
      const mockRow = { id: '1', email: 'user1@example.com', name: 'User 1' };
      mockClient.find.mockResolvedValue({ rows: [mockRow], warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.findOne('[Email] = "user1@example.com"');

      expect(result).toEqual(mockRow);
      expect(mockClient.find).toHaveBeenCalledWith({
        tableName: 'users',
        selector: '[Email] = "user1@example.com"',
      });
    });

    it('should return null when findOne finds no rows', async () => {
      mockClient.find.mockResolvedValue({ rows: [], warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.findOne('[Email] = "nonexistent@example.com"');

      expect(result).toBeNull();
    });

    it('should find rows with optional selector', async () => {
      const mockRows = [{ id: '1', email: 'user1@example.com', name: 'User 1' }];
      mockClient.find.mockResolvedValue({ rows: mockRows, warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.find('[Status] = "Active"');

      expect(result).toEqual(mockRows);
      expect(mockClient.find).toHaveBeenCalledWith({
        tableName: 'users',
        selector: '[Status] = "Active"',
      });
    });

    it('should find all rows when no selector provided', async () => {
      const mockRows = [
        { id: '1', email: 'user1@example.com', name: 'User 1' },
        { id: '2', email: 'user2@example.com', name: 'User 2' },
      ];
      mockClient.find.mockResolvedValue({ rows: mockRows, warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.find();

      expect(result).toEqual(mockRows);
      expect(mockClient.find).toHaveBeenCalledWith({ tableName: 'users', selector: undefined });
    });
  });

  describe('Delete operations', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
        },
      };
    });

    it('should delete rows by key', async () => {
      mockClient.delete.mockResolvedValue({ success: true, deletedCount: 2, warnings: [] });

      const table = new DynamicTable(mockClient, tableDef);
      const result = await table.delete([{ id: '1' }, { id: '2' }]);

      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith({
        tableName: 'users',
        rows: [{ id: '1' }, { id: '2' }],
      });
    });
  });

  describe('Table metadata methods', () => {
    beforeEach(() => {
      tableDef = {
        tableName: 'extract_worklog',
        keyField: 'worklog_id',
        fields: {
          worklog_id: { type: 'Text', required: true },
          date: { type: 'Date', required: true },
          hours: { type: 'Number', required: true },
        },
      };
    });

    it('should return table definition', () => {
      const table = new DynamicTable(mockClient, tableDef);
      const def = table.getDefinition();

      expect(def).toEqual(tableDef);
      expect(def.tableName).toBe('extract_worklog');
      expect(def.keyField).toBe('worklog_id');
      expect(Object.keys(def.fields)).toEqual(['worklog_id', 'date', 'hours']);
    });

    it('should return table name', () => {
      const table = new DynamicTable(mockClient, tableDef);
      expect(table.getTableName()).toBe('extract_worklog');
    });

    it('should return key field', () => {
      const table = new DynamicTable(mockClient, tableDef);
      expect(table.getKeyField()).toBe('worklog_id');
    });
  });

  describe('Integration tests - Realistic workflows', () => {
    it('should handle complete CRUD workflow with mixed field types', async () => {
      const tableDef: TableDefinition = {
        tableName: 'projects',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          name: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          website: { type: 'URL', required: false },
          status: {
            type: 'Enum',
            required: true,
            allowedValues: ['Planning', 'Active', 'Completed', 'On Hold'],
          },
          tags: {
            type: 'EnumList',
            required: false,
            allowedValues: ['Frontend', 'Backend', 'Mobile', 'DevOps'],
          },
          progress: { type: 'Percent', required: false },
          startDate: { type: 'Date', required: true },
          budget: { type: 'Price', required: false },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Create
      mockClient.add.mockResolvedValue({
        rows: [
          {
            id: '1',
            name: 'Project Alpha',
            email: 'contact@alpha.com',
            website: 'https://alpha.com',
            status: 'Active',
            tags: ['Frontend', 'Backend'],
            progress: 0.35,
            startDate: '2025-01-01',
            budget: 50000,
          },
        ],
        warnings: [],
      });

      const created = await table.add([
        {
          id: '1',
          name: 'Project Alpha',
          email: 'contact@alpha.com',
          website: 'https://alpha.com',
          status: 'Active',
          tags: ['Frontend', 'Backend'],
          progress: 0.35,
          startDate: '2025-01-01',
          budget: 50000,
        },
      ]);

      expect(created).toHaveLength(1);
      expect(created[0].id).toBe('1');

      // Read
      mockClient.find.mockResolvedValue({ rows: created, warnings: [] });
      const found = await table.find('[Status] = "Active"');
      expect(found).toEqual(created);

      // Update
      mockClient.update.mockResolvedValue({
        rows: [{ ...created[0], progress: 0.75, status: 'Completed' }],
        warnings: [],
      });

      const updated = await table.update([{ id: '1', progress: 0.75, status: 'Completed' }]);
      expect(updated[0].progress).toBe(0.75);
      expect(updated[0].status).toBe('Completed');

      // Delete
      mockClient.delete.mockResolvedValue({ success: true, deletedCount: 1, warnings: [] });
      const deleted = await table.delete([{ id: '1' }]);
      expect(deleted).toBe(true);
    });

    it('should handle validation errors in multi-step workflow', async () => {
      const tableDef: TableDefinition = {
        tableName: 'users',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          status: {
            type: 'Enum',
            required: true,
            allowedValues: ['Active', 'Inactive', 'Suspended'],
          },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Invalid email should fail
      await expect(
        table.add([{ id: '1', email: 'invalid-email', status: 'Active' }])
      ).rejects.toThrow(ValidationError);

      // Invalid enum should fail
      await expect(
        table.add([{ id: '1', email: 'user@example.com', status: 'Unknown' as any }])
      ).rejects.toThrow(ValidationError);

      // Valid data should succeed
      mockClient.add.mockResolvedValue({
        rows: [{ id: '1', email: 'user@example.com', status: 'Active' }],
        warnings: [],
      });

      await expect(
        table.add([{ id: '1', email: 'user@example.com', status: 'Active' }])
      ).resolves.not.toThrow();
    });

    it('should handle batch operations with partial updates', async () => {
      const tableDef: TableDefinition = {
        tableName: 'tasks',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          title: { type: 'Text', required: true },
          priority: {
            type: 'Enum',
            required: true,
            allowedValues: ['Low', 'Medium', 'High', 'Critical'],
          },
          progress: { type: 'Percent', required: false },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Batch update with different fields
      mockClient.update.mockResolvedValue({
        rows: [
          { id: '1', title: 'Task 1', priority: 'High', progress: 0.8 },
          { id: '2', title: 'Task 2', priority: 'Low', progress: 0.1 },
          { id: '3', title: 'Task 3', priority: 'Critical', progress: 0.5 },
        ],
        warnings: [],
      });

      const updated = await table.update([
        { id: '1', progress: 0.8 }, // Only update progress
        { id: '2', priority: 'Low' }, // Only update priority
        { id: '3', progress: 0.5, priority: 'Critical' }, // Update both
      ]);

      expect(updated).toHaveLength(3);
      expect(updated[0].progress).toBe(0.8);
      expect(updated[1].priority).toBe('Low');
      expect(updated[2].progress).toBe(0.5);
    });
  });

  describe('Edge cases and error messages', () => {
    it('should provide clear error messages for multiple validation failures', async () => {
      const tableDef: TableDefinition = {
        tableName: 'contacts',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
          phone: { type: 'Phone', required: true },
          website: { type: 'URL', required: false },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Invalid email
      try {
        await table.add([{ id: '1', email: 'bad-email', phone: '+1234567890', website: 'https://example.com' }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('email');
        expect(error.message).toContain('valid email');
      }

      // Invalid phone
      try {
        await table.add([{ id: '1', email: 'user@example.com', phone: 'abc', website: 'https://example.com' }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('phone');
      }

      // Invalid URL
      try {
        await table.add([{ id: '1', email: 'user@example.com', phone: '+1234567890', website: 'not-a-url' }]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('website');
        expect(error.message).toContain('valid URL');
      }
    });

    it('should handle null and undefined values correctly', async () => {
      const tableDef: TableDefinition = {
        tableName: 'optional_fields',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          optionalEmail: { type: 'Email', required: false },
          optionalNumber: { type: 'Number', required: false },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      mockClient.add.mockResolvedValue({
        rows: [{ id: '1', optionalEmail: null, optionalNumber: undefined }],
        warnings: [],
      });

      // Null/undefined for optional fields should be allowed
      await expect(
        table.add([{ id: '1', optionalEmail: null as any, optionalNumber: undefined }])
      ).resolves.not.toThrow();
    });

    it('should validate row index in error messages', async () => {
      const tableDef: TableDefinition = {
        tableName: 'batch',
        keyField: 'id',
        fields: {
          id: { type: 'Text', required: true },
          email: { type: 'Email', required: true },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Second row has invalid email
      try {
        await table.add([
          { id: '1', email: 'valid@example.com' },
          { id: '2', email: 'invalid-email' },
          { id: '3', email: 'another@example.com' },
        ]);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Row 1'); // 0-indexed, shown as "Row 1"
      }
    });
  });
});
