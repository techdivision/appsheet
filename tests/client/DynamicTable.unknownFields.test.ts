/**
 * Integration tests: DynamicTable with UnknownFieldPolicy
 *
 * Tests policy application in add(), update(), and delete() operations.
 * Verifies DI injection pattern and default behavior.
 *
 * @see docs/SOSO-435/INTEGRATION_CONCEPT.md
 */

import { DynamicTable } from '../../src/client/DynamicTable';
import {
  AppSheetClientInterface,
  TableDefinition,
  ValidationError,
  UnknownFieldPolicyInterface,
} from '../../src/types';
import { IgnoreUnknownFieldPolicy } from '../../src/utils/policies/IgnoreUnknownFieldPolicy';
import { ErrorUnknownFieldPolicy } from '../../src/utils/policies/ErrorUnknownFieldPolicy';

/**
 * Create a mock client that implements AppSheetClientInterface
 * (Same pattern as DynamicTable.test.ts)
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
      keyField: 'solution_id',
      fields: { solution_id: { type: 'Text', required: true } },
    }),
  };
}

/**
 * Table definition for integration tests.
 * Has 'solution_id' and 'name' as known fields.
 * Any other field (e.g., 'id', 'unknown', 'extra') is unknown.
 */
const tableDef: TableDefinition = {
  tableName: 'solution',
  keyField: 'solution_id',
  fields: {
    solution_id: { type: 'Text', required: true },
    name: { type: 'Text', required: false },
  },
};

describe('DynamicTable Unknown Field Handling', () => {
  let mockClient: jest.Mocked<AppSheetClientInterface>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe('default behavior (StripUnknownFieldPolicy)', () => {
    it('should strip unknown fields in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.add([{ solution_id: '1', unknown: 'value' }]);

      expect(mockClient.add).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1' }],
      });
    });

    it('should strip unknown fields in update()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.update([{ solution_id: '1', unknown: 'value' }]);

      expect(mockClient.update).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1' }],
      });
    });

    it('should strip unknown fields in delete()', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.delete([{ solution_id: '1', id: '1' }]);

      // 'id' is NOT in the schema, should be stripped
      expect(mockClient.delete).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1' }],
      });
    });

    it('should not strip known fields', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.add([{ solution_id: '1', name: 'Test' }]);

      expect(mockClient.add).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', name: 'Test' }],
      });
    });

    it('should handle multiple rows with mixed unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef);
      await table.add([
        { solution_id: '1', name: 'A', extra: 'x' },
        { solution_id: '2', bad: 'y' },
      ]);

      expect(mockClient.add).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', name: 'A' }, { solution_id: '2' }],
      });
    });
  });

  describe('with injected IgnoreUnknownFieldPolicy', () => {
    it('should pass unknown fields through in add()', async () => {
      const table = new DynamicTable(mockClient, tableDef, new IgnoreUnknownFieldPolicy());
      await table.add([{ solution_id: '1', unknown: 'value' }]);

      expect(mockClient.add).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', unknown: 'value' }],
      });
    });

    it('should pass unknown fields through in update()', async () => {
      const table = new DynamicTable(mockClient, tableDef, new IgnoreUnknownFieldPolicy());
      await table.update([{ solution_id: '1', unknown: 'value' }]);

      expect(mockClient.update).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', unknown: 'value' }],
      });
    });

    it('should pass unknown fields through in delete()', async () => {
      const table = new DynamicTable(mockClient, tableDef, new IgnoreUnknownFieldPolicy());
      await table.delete([{ solution_id: '1', id: '1' }]);

      expect(mockClient.delete).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', id: '1' }],
      });
    });
  });

  describe('with injected ErrorUnknownFieldPolicy', () => {
    it('should throw in add() for unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());

      await expect(table.add([{ solution_id: '1', unknown: 'value' }])).rejects.toThrow(
        ValidationError
      );
      // Should NOT have called the client
      expect(mockClient.add).not.toHaveBeenCalled();
    });

    it('should throw in update() for unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());

      await expect(table.update([{ solution_id: '1', unknown: 'value' }])).rejects.toThrow(
        ValidationError
      );
      expect(mockClient.update).not.toHaveBeenCalled();
    });

    it('should throw in delete() for unknown fields', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());

      await expect(table.delete([{ solution_id: '1', id: '1' }])).rejects.toThrow(ValidationError);
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('should not throw when all fields are known', async () => {
      const table = new DynamicTable(mockClient, tableDef, new ErrorUnknownFieldPolicy());

      await expect(table.add([{ solution_id: '1', name: 'Test' }])).resolves.not.toThrow();

      expect(mockClient.add).toHaveBeenCalled();
    });
  });

  describe('with custom policy (DI)', () => {
    it('should accept any UnknownFieldPolicyInterface implementation', async () => {
      const applySpy = jest.fn(
        (_tableName: string, rows: Partial<Record<string, any>>[], _knownFields: string[]) => rows
      );
      const customPolicy = { apply: applySpy } as unknown as UnknownFieldPolicyInterface;
      const table = new DynamicTable(mockClient, tableDef, customPolicy);
      await table.add([{ solution_id: '1', extra: 'value' }]);

      expect(applySpy).toHaveBeenCalledWith(
        'solution',
        expect.any(Array),
        expect.arrayContaining(['solution_id', 'name'])
      );
    });

    it('should use the custom policy return value', async () => {
      // Custom policy that uppercases all string values
      const applySpy = jest.fn(
        (_tableName: string, rows: Partial<Record<string, any>>[], _knownFields: string[]) =>
          rows.map((row) => {
            const newRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
              newRow[key] = typeof value === 'string' ? value.toUpperCase() : value;
            }
            return newRow;
          })
      );
      const uppercasePolicy = { apply: applySpy } as unknown as UnknownFieldPolicyInterface;
      const table = new DynamicTable(mockClient, tableDef, uppercasePolicy);
      await table.add([{ solution_id: '1', name: 'test' }]);

      expect(mockClient.add).toHaveBeenCalledWith({
        tableName: 'solution',
        rows: [{ solution_id: '1', name: 'TEST' }],
      });
    });

    it('should call policy for delete() operations', async () => {
      const applySpy = jest.fn(
        (_tableName: string, rows: Partial<Record<string, any>>[], _knownFields: string[]) => rows
      );
      const customPolicy = { apply: applySpy } as unknown as UnknownFieldPolicyInterface;
      const table = new DynamicTable(mockClient, tableDef, customPolicy);
      await table.delete([{ solution_id: '1' }]);

      expect(applySpy).toHaveBeenCalledWith(
        'solution',
        [{ solution_id: '1' }],
        expect.arrayContaining(['solution_id', 'name'])
      );
    });
  });
});
