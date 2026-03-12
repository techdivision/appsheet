/**
 * Integration tests for DynamicTable with WriteConversionPolicy
 * @see docs/SOSO-440/FEATURE_CONCEPT.md
 */

import { DynamicTable } from '../../src/client/DynamicTable';
import { AppSheetClientInterface, TableDefinition } from '../../src/types';
import { LocaleWriteConversionPolicy } from '../../src/utils/policies';

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

describe('DynamicTable with WriteConversionPolicy', () => {
  let mockClient: jest.Mocked<AppSheetClientInterface>;

  const tableDef: TableDefinition = {
    tableName: 'extract_worklog',
    keyField: 'id',
    locale: 'de-DE',
    fields: {
      id: { type: 'Text', required: true },
      date: { type: 'Date', required: true },
      created_at: { type: 'DateTime', required: false },
      description: { type: 'Text', required: false },
    },
  };

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ============================================
  // add() with LocaleWriteConversionPolicy
  // ============================================

  describe('add() with LocaleWriteConversionPolicy', () => {
    it('should convert ISO date to locale format before sending to client', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined, // default unknown field policy
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12', description: 'Test' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ id: '1', date: '12.03.2026', description: 'Test' })],
        })
      );
    });

    it('should convert ISO datetime to locale format before sending to client', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12', created_at: '2026-03-12T14:30:00.000Z' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              date: '12.03.2026',
              created_at: '12.03.2026 14:30:00',
            }),
          ],
        })
      );
    });

    it('should convert ISO dates with en-US locale', async () => {
      const enUsDef: TableDefinition = {
        ...tableDef,
        locale: 'en-US',
      };
      const table = new DynamicTable(
        mockClient,
        enUsDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ date: '03/12/2026' })],
        })
      );
    });

    it('should not convert non-date fields', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12', description: '2026-03-12 is a date' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              description: '2026-03-12 is a date', // Text field unchanged
              date: '12.03.2026', // Date field converted
            }),
          ],
        })
      );
    });
  });

  // ============================================
  // update() with LocaleWriteConversionPolicy
  // ============================================

  describe('update() with LocaleWriteConversionPolicy', () => {
    it('should convert ISO date to locale format before sending to client', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.update([{ id: '1', date: '2026-03-12' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ id: '1', date: '12.03.2026' })],
        })
      );
    });

    it('should convert ISO datetime to locale format before sending to client', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.update([{ id: '1', created_at: '2026-03-12T14:30:00Z' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ created_at: '12.03.2026 14:30:00' })],
        })
      );
    });
  });

  // ============================================
  // delete() — NO write conversion
  // ============================================

  describe('delete() does NOT apply write conversion', () => {
    it('should pass keys through unchanged', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.delete([{ id: '1' }]);

      // delete() should pass keys through without conversion
      expect(mockClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [{ id: '1' }],
        })
      );
    });
  });

  // ============================================
  // Default behavior (NoOp, backward compatible)
  // ============================================

  describe('default NoOp behavior (backward compatible)', () => {
    it('should send ISO dates unchanged when no policy is provided', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      // No writeConversionPolicy → default NoOp

      await table.add([{ id: '1', date: '2026-03-12' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ date: '2026-03-12' })],
        })
      );
    });

    it('should send ISO datetimes unchanged when no policy is provided', async () => {
      const table = new DynamicTable(mockClient, tableDef);

      await table.add([{ id: '1', date: '2026-03-12', created_at: '2026-03-12T14:30:00.000Z' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              date: '2026-03-12',
              created_at: '2026-03-12T14:30:00.000Z',
            }),
          ],
        })
      );
    });
  });

  // ============================================
  // Round-trip: find() → update() with locale dates
  // ============================================

  describe('Round-trip: find() → update() with locale dates', () => {
    it('should pass through locale-formatted dates from find() unchanged in update()', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      // Simulate: find() returned locale-formatted data from AppSheet
      // User modifies only description, date stays as-is from AppSheet
      await table.update([
        { id: '1', date: '12.03.2026', created_at: '12.03.2026 14:30:00', description: 'Updated' },
      ]);

      // Locale dates should pass through unchanged (not double-converted)
      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              date: '12.03.2026', // NOT re-converted
              created_at: '12.03.2026 14:30:00', // NOT re-converted
              description: 'Updated',
            }),
          ],
        })
      );
    });

    it('should handle mixed ISO and locale dates in same update', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      // date: from AppSheet (locale), created_at: new ISO value from consumer
      await table.update([{ id: '1', date: '12.03.2026', created_at: '2026-03-12T18:00:00Z' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              date: '12.03.2026', // Already locale → pass through
              created_at: '12.03.2026 18:00:00', // ISO → converted
            }),
          ],
        })
      );
    });
  });

  // ============================================
  // Without locale (no conversion possible)
  // ============================================

  describe('without locale (no conversion)', () => {
    it('should act as no-op when table has no locale', async () => {
      const noLocaleDef: TableDefinition = {
        tableName: 'extract_worklog',
        keyField: 'id',
        // no locale
        fields: {
          id: { type: 'Text', required: true },
          date: { type: 'Date', required: true },
        },
      };
      const table = new DynamicTable(
        mockClient,
        noLocaleDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12' }]);

      // Without locale, LocaleWriteConversionPolicy acts as no-op
      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ date: '2026-03-12' })],
        })
      );
    });
  });

  // ============================================
  // ChangeTimestamp field
  // ============================================

  describe('ChangeTimestamp field conversion', () => {
    it('should convert ChangeTimestamp ISO values like DateTime', async () => {
      const changeTimestampDef: TableDefinition = {
        tableName: 'audit_log',
        keyField: 'id',
        locale: 'de-DE',
        fields: {
          id: { type: 'Text', required: true },
          modified_at: { type: 'ChangeTimestamp', required: false },
        },
      };
      const table = new DynamicTable(
        mockClient,
        changeTimestampDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.update([{ id: '1', modified_at: '2026-03-12T14:30:00Z' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ modified_at: '12.03.2026 14:30:00' })],
        })
      );
    });
  });

  // ============================================
  // Locale in properties still sent correctly
  // ============================================

  describe('Locale in properties with write conversion', () => {
    it('should send both converted rows AND Locale property on add()', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.add([{ id: '1', date: '2026-03-12' }]);

      expect(mockClient.add).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ date: '12.03.2026' })],
          properties: expect.objectContaining({ Locale: 'de-DE' }),
        })
      );
    });

    it('should send both converted rows AND Locale property on update()', async () => {
      const table = new DynamicTable(
        mockClient,
        tableDef,
        undefined,
        new LocaleWriteConversionPolicy()
      );

      await table.update([{ id: '1', date: '2026-03-12' }]);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [expect.objectContaining({ date: '12.03.2026' })],
          properties: expect.objectContaining({ Locale: 'de-DE' }),
        })
      );
    });
  });
});
