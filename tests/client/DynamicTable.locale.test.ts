/**
 * Integration tests for DynamicTable with locale-aware date/datetime validation
 * @see docs/SOSO-439/BUGFIX_CONCEPT.md
 */

import { DynamicTable } from '../../src/client/DynamicTable';
import { AppSheetClientInterface, TableDefinition, ValidationError } from '../../src/types';

/**
 * Create a mock client that implements AppSheetClientInterface
 */
function createMockClient(): jest.Mocked<AppSheetClientInterface> {
  return {
    add: jest.fn().mockResolvedValue({ rows: [], warnings: [] }),
    find: jest.fn().mockResolvedValue({ rows: [], warnings: [] }),
    update: jest.fn().mockResolvedValue({ rows: [], warnings: [] }),
    delete: jest.fn().mockResolvedValue({ success: true, deletedCount: 0, warnings: [] }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    addOne: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue(true),
    getTable: jest.fn().mockReturnValue({
      tableName: 'test',
      keyField: 'id',
      fields: { id: { type: 'Text', required: true } },
    }),
  };
}

describe('DynamicTable with locale', () => {
  let mockClient: jest.Mocked<AppSheetClientInterface>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ============================================
  // Date field with locale
  // ============================================

  describe('Date field with de-DE locale', () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      locale: 'de-DE',
      fields: {
        id: { type: 'Text', required: true },
        date: { type: 'Date', required: true },
      },
    };

    it('should accept DD.MM.YYYY (de-DE format) in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', date: '11.03.2026' }])).resolves.not.toThrow();
    });

    it('should accept ISO 8601 in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', date: '2026-03-11' }])).resolves.not.toThrow();
    });

    it('should reject MM/DD/YYYY (en-US format) in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', date: '03/11/2026' }])).rejects.toThrow(ValidationError);
    });

    it('should accept DD.MM.YYYY in update()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.update([{ id: '1', date: '11.03.2026' }])).resolves.not.toThrow();
    });

    it('should reject wrong format in update()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.update([{ id: '1', date: '03/11/2026' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Date field with en-US locale', () => {
    const tableDef: TableDefinition = {
      tableName: 'reports',
      keyField: 'id',
      locale: 'en-US',
      fields: {
        id: { type: 'Text', required: true },
        dueDate: { type: 'Date', required: true },
      },
    };

    it('should accept MM/DD/YYYY', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', dueDate: '03/11/2026' }])).resolves.not.toThrow();
    });

    it('should accept ISO 8601', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', dueDate: '2026-03-11' }])).resolves.not.toThrow();
    });

    it('should reject DD.MM.YYYY (de-DE format)', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', dueDate: '11.03.2026' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  // ============================================
  // DateTime field with locale
  // ============================================

  describe('DateTime field with en-US locale', () => {
    const tableDef: TableDefinition = {
      tableName: 'logs',
      keyField: 'id',
      locale: 'en-US',
      fields: {
        id: { type: 'Text', required: true },
        timestamp: { type: 'DateTime', required: true },
      },
    };

    it('should accept MM/DD/YYYY HH:mm:ss', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.add([{ id: '1', timestamp: '03/11/2026 21:51:24' }])
      ).resolves.not.toThrow();
    });

    it('should accept ISO 8601', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.add([{ id: '1', timestamp: '2026-03-11T21:51:24.000Z' }])
      ).resolves.not.toThrow();
    });

    it('should reject DD.MM.YYYY HH:mm:ss (de-DE format)', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', timestamp: '11.03.2026 21:51:24' }])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('DateTime field with de-DE locale', () => {
    const tableDef: TableDefinition = {
      tableName: 'events',
      keyField: 'id',
      locale: 'de-DE',
      fields: {
        id: { type: 'Text', required: true },
        createdAt: { type: 'DateTime', required: true },
      },
    };

    it('should accept DD.MM.YYYY HH:mm:ss', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.add([{ id: '1', createdAt: '11.03.2026 21:51:24' }])
      ).resolves.not.toThrow();
    });

    it('should accept ISO 8601', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.add([{ id: '1', createdAt: '2026-03-11T21:51:24' }])
      ).resolves.not.toThrow();
    });
  });

  // ============================================
  // ChangeTimestamp with locale
  // ============================================

  describe('ChangeTimestamp field with locale', () => {
    const tableDef: TableDefinition = {
      tableName: 'audit',
      keyField: 'id',
      locale: 'en-US',
      fields: {
        id: { type: 'Text', required: true },
        modifiedAt: { type: 'ChangeTimestamp', required: false },
      },
    };

    it('should accept locale-formatted datetime', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.update([{ id: '1', modifiedAt: '03/11/2026 21:51:24' }])
      ).resolves.not.toThrow();
    });

    it('should accept ISO 8601', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.update([{ id: '1', modifiedAt: '2026-03-11T21:51:24Z' }])
      ).resolves.not.toThrow();
    });
  });

  // ============================================
  // Without locale (permissive mode)
  // ============================================

  describe('without locale (permissive mode)', () => {
    const tableDef: TableDefinition = {
      tableName: 'worklogs',
      keyField: 'id',
      // no locale set
      fields: {
        id: { type: 'Text', required: true },
        date: { type: 'Date', required: true },
        timestamp: { type: 'DateTime', required: false },
      },
    };

    it('should accept any plausible date format', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', date: '03/11/2026' }])).resolves.not.toThrow();
      await expect(table.add([{ id: '2', date: '11.03.2026' }])).resolves.not.toThrow();
      await expect(table.add([{ id: '3', date: '2026-03-11' }])).resolves.not.toThrow();
    });

    it('should accept any plausible datetime format', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(
        table.add([{ id: '1', date: '2026-03-11', timestamp: '03/11/2026 21:51:24' }])
      ).resolves.not.toThrow();
      await expect(
        table.add([{ id: '2', date: '2026-03-11', timestamp: '11.03.2026 21:51:24' }])
      ).resolves.not.toThrow();
    });

    it('should reject obviously invalid date strings', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await expect(table.add([{ id: '1', date: 'not-a-date' }])).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // Locale in properties sent to client
  // ============================================

  describe('Locale in client properties', () => {
    it('should send Locale in properties on add()', async () => {
      const tableDef: TableDefinition = {
        tableName: 'worklogs',
        keyField: 'id',
        locale: 'de-DE',
        fields: { id: { type: 'Text', required: true } },
      };
      const table = new DynamicTable(mockClient, tableDef);
      await table.add([{ id: '1' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ Locale: 'de-DE' }),
        })
      );
    });

    it('should send Locale in properties on update()', async () => {
      const tableDef: TableDefinition = {
        tableName: 'worklogs',
        keyField: 'id',
        locale: 'en-US',
        fields: { id: { type: 'Text', required: true } },
      };
      const table = new DynamicTable(mockClient, tableDef);
      await table.update([{ id: '1' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ Locale: 'en-US' }),
        })
      );
    });

    it('should not send Locale when no locale is set', async () => {
      const tableDef: TableDefinition = {
        tableName: 'worklogs',
        keyField: 'id',
        // no locale
        fields: { id: { type: 'Text', required: true } },
      };
      const table = new DynamicTable(mockClient, tableDef);
      await table.add([{ id: '1' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: undefined,
        })
      );
    });
  });

  // ============================================
  // Real-world scenario: the original bug
  // ============================================

  describe('Real-world bug scenario (SOSO-439)', () => {
    it('should accept AppSheet en-US formatted date in update() after find()', async () => {
      // Simulate the bug scenario:
      // 1. add() sends ISO 8601 "2026-03-11T21:51:24.000Z"
      // 2. find() returns en-US formatted "03/11/2026 21:51:24"
      // 3. update() must accept the en-US format
      const tableDef: TableDefinition = {
        tableName: 'extract_worklog',
        keyField: 'worklog_id',
        locale: 'en-US',
        fields: {
          worklog_id: { type: 'Text', required: true },
          date: { type: 'Date', required: true },
          created_at: { type: 'DateTime', required: false },
        },
      };

      const table = new DynamicTable(mockClient, tableDef);

      // Step 1: add with ISO (always works)
      await expect(
        table.add([{ worklog_id: '1', date: '2026-03-11', created_at: '2026-03-11T21:51:24.000Z' }])
      ).resolves.not.toThrow();

      // Step 3: update with locale-formatted data from find()
      // This is where the original bug occurred!
      await expect(
        table.update([{ worklog_id: '1', date: '03/11/2026', created_at: '03/11/2026 21:51:24' }])
      ).resolves.not.toThrow();
    });
  });
});
