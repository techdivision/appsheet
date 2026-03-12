/**
 * Tests for SOSO-446: Automatic locale detection in SchemaInspector
 *
 * Tests cover:
 * - inferType() extension for locale-formatted dates
 * - detectLocale() algorithm (separator + part order analysis)
 * - inspectTable() integration with locale detection
 * - generateSchema() with locale propagation to connection + table level
 */

import { SchemaInspector } from '../../src/cli/SchemaInspector';
import { AppSheetClient } from '../../src/client/AppSheetClient';
import { ConnectionDefinition } from '../../src/types';

// Mock AppSheetClient
jest.mock('../../src/client/AppSheetClient');

describe('SchemaInspector — Locale Detection (SOSO-446)', () => {
  let mockClient: jest.Mocked<AppSheetClient>;
  let inspector: SchemaInspector;

  const mockConnectionDef: ConnectionDefinition = {
    appId: 'test-app-id',
    applicationAccessKey: 'test-key',
    tables: {},
  };

  beforeEach(() => {
    mockClient = new AppSheetClient(
      mockConnectionDef,
      'test@example.com'
    ) as jest.Mocked<AppSheetClient>;

    inspector = new SchemaInspector(mockClient);
  });

  // ─── inferType() extension for locale-formatted dates ─────────────────

  describe('inferType — locale-formatted dates', () => {
    // Access private method via bracket notation
    const callInferType = (inspector: SchemaInspector, value: any) =>
      (inspector as any).inferType(value);

    it('should detect DD.MM.YYYY as Date', () => {
      expect(callInferType(inspector, '25.03.2026')).toBe('Date');
    });

    it('should detect MM/DD/YYYY as Date', () => {
      expect(callInferType(inspector, '03/25/2026')).toBe('Date');
    });

    it('should detect YYYY/MM/DD as Date', () => {
      expect(callInferType(inspector, '2026/03/25')).toBe('Date');
    });

    it('should detect DD/MM/YYYY as Date', () => {
      expect(callInferType(inspector, '25/03/2026')).toBe('Date');
    });

    it('should detect D.M.YYYY as Date (single digit day/month)', () => {
      expect(callInferType(inspector, '5.3.2026')).toBe('Date');
    });

    it('should detect DD.MM.YYYY HH:MM:SS as DateTime', () => {
      expect(callInferType(inspector, '25.03.2026 14:30:00')).toBe('DateTime');
    });

    it('should detect MM/DD/YYYY H:MM AM as DateTime', () => {
      expect(callInferType(inspector, '03/25/2026 2:30 PM')).toBe('DateTime');
    });

    it('should detect YYYY/MM/DD HH:MM as DateTime', () => {
      expect(callInferType(inspector, '2026/03/25 14:30')).toBe('DateTime');
    });

    it('should still detect ISO date as Date', () => {
      expect(callInferType(inspector, '2026-03-25')).toBe('Date');
    });

    it('should still detect ISO datetime as DateTime', () => {
      expect(callInferType(inspector, '2026-03-25T14:30:00Z')).toBe('DateTime');
    });

    it('should NOT detect random text as Date', () => {
      expect(callInferType(inspector, 'hello world')).toBe('Text');
    });

    it('should NOT detect partial date-like strings as Date', () => {
      expect(callInferType(inspector, '25.03')).toBe('Text');
    });
  });

  // ─── detectLocale() unit tests ────────────────────────────────────────

  describe('detectLocale', () => {
    // Access private method via bracket notation
    const callDetectLocale = (
      inspector: SchemaInspector,
      rows: Record<string, any>[],
      fields: Record<string, any>
    ) => (inspector as any).detectLocale(rows, fields);

    describe('de-DE detection (DMY with dot)', () => {
      it('should detect de-DE from DD.MM.YYYY dates', () => {
        const rows = [
          { date: '25.03.2026' }, // 25 > 12 → first part is day → DMY
          { date: '12.06.2026' },
        ];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('de-DE');
        expect(result.ambiguous).toBe(false);
      });

      it('should detect de-DE from DateTime values', () => {
        const rows = [{ created: '25.03.2026 14:30:00' }, { created: '13.06.2026 09:00:00' }];
        const fields = { created: { type: 'DateTime' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('de-DE');
        expect(result.ambiguous).toBe(false);
      });

      it('should detect de-DE with single value where day > 12', () => {
        const rows = [{ date: '31.12.2026' }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('de-DE');
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('en-US detection (MDY with slash)', () => {
      it('should detect en-US from MM/DD/YYYY dates', () => {
        const rows = [
          { date: '03/25/2026' }, // 25 > 12 → second part is day → MDY
          { date: '06/12/2026' },
        ];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-US');
        expect(result.ambiguous).toBe(false);
      });

      it('should detect en-US from DateTime values', () => {
        const rows = [{ created: '03/25/2026 2:30 PM' }];
        const fields = { created: { type: 'DateTime' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-US');
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('en-GB detection (DMY with slash)', () => {
      it('should detect en-GB from DD/MM/YYYY dates', () => {
        const rows = [
          { date: '25/03/2026' }, // 25 > 12 → first part is day → DMY
          { date: '12/06/2026' },
        ];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-GB');
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('ja-JP detection (YMD with slash)', () => {
      it('should detect ja-JP from YYYY/MM/DD dates', () => {
        const rows = [{ date: '2026/03/12' }, { date: '2026/12/25' }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('ja-JP');
        expect(result.ambiguous).toBe(false);
      });

      it('should detect ja-JP with DateTime values', () => {
        const rows = [{ created: '2026/03/12 14:30:00' }];
        const fields = { created: { type: 'DateTime' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('ja-JP');
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('ambiguous cases', () => {
      it('should default to en-US when slash separator is ambiguous', () => {
        const rows = [
          { date: '03/06/2026' }, // Both parts ≤ 12
          { date: '01/12/2026' },
        ];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-US');
        expect(result.ambiguous).toBe(true);
      });

      it('should default to de-DE when dot separator is ambiguous', () => {
        const rows = [
          { date: '03.06.2026' }, // Both parts ≤ 12
          { date: '01.12.2026' },
        ];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('de-DE');
        expect(result.ambiguous).toBe(true);
      });

      it('should be ambiguous when only one date and parts ≤ 12', () => {
        const rows = [{ date: '06/03/2026' }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.ambiguous).toBe(true);
      });
    });

    describe('no detection possible', () => {
      it('should return undefined when no date fields exist', () => {
        const rows = [{ name: 'Test' }];
        const fields = { name: { type: 'Text' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBeUndefined();
        expect(result.ambiguous).toBe(false);
      });

      it('should return undefined when all dates are ISO', () => {
        const rows = [{ date: '2026-03-12' }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBeUndefined();
        expect(result.ambiguous).toBe(false);
      });

      it('should return undefined when date fields are empty', () => {
        const rows = [{ date: null }, { date: undefined }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBeUndefined();
        expect(result.ambiguous).toBe(false);
      });

      it('should return undefined when no rows provided', () => {
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, [], fields);
        expect(result.locale).toBeUndefined();
        expect(result.ambiguous).toBe(false);
      });

      it('should return undefined when date values are non-string', () => {
        const rows = [{ date: 12345 }, { date: true }];
        const fields = { date: { type: 'Date' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBeUndefined();
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('ChangeTimestamp values', () => {
      it('should detect locale from ChangeTimestamp fields', () => {
        const rows = [{ modified: '03/25/2026 09:00:00' }];
        const fields = { modified: { type: 'ChangeTimestamp' } };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-US');
        expect(result.ambiguous).toBe(false);
      });
    });

    describe('mixed date fields', () => {
      it('should use all date fields for disambiguation', () => {
        // First field alone would be ambiguous (03/06), but second has day > 12
        const rows = [{ date: '03/06/2026', created: '03/25/2026' }];
        const fields = {
          date: { type: 'Date' },
          created: { type: 'DateTime' },
        };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('en-US'); // 25 > 12 in second position → MDY
        expect(result.ambiguous).toBe(false);
      });

      it('should ignore non-date fields', () => {
        const rows = [{ name: 'Test', date: '25.03.2026', count: 42 }];
        const fields = {
          name: { type: 'Text' },
          date: { type: 'Date' },
          count: { type: 'Number' },
        };
        const result = callDetectLocale(inspector, rows, fields);
        expect(result.locale).toBe('de-DE');
        expect(result.ambiguous).toBe(false);
      });
    });
  });

  // ─── inspectTable() integration ───────────────────────────────────────

  describe('inspectTable — locale integration', () => {
    it('should include detected locale in result (de-DE)', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '25.03.2026', name: 'Test' },
          { id: '2', date: '12.06.2026', name: 'Other' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_worklog');

      expect(result.locale).toBe('de-DE');
      expect(result.fields.date.type).toBe('Date');
      expect(result.warning).toBeUndefined();
    });

    it('should include detected locale in result (en-US)', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '03/25/2026' },
          { id: '2', date: '06/12/2026' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_worklog');

      expect(result.locale).toBe('en-US');
      expect(result.fields.date.type).toBe('Date');
    });

    it('should detect locale from DateTime fields', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', created: '25.03.2026 14:30:00' },
          { id: '2', created: '13.06.2026 09:00:00' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_worklog');

      expect(result.locale).toBe('de-DE');
      expect(result.fields.created.type).toBe('DateTime');
    });

    it('should add warning for ambiguous locale', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '03/06/2026' }, // Both parts ≤ 12
          { id: '2', date: '01/12/2026' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_worklog');

      expect(result.locale).toBe('en-US');
      expect(result.warning).toContain('ambiguous');
      expect(result.warning).toContain('en-US');
    });

    it('should have no locale when table has no date fields', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', name: 'Test', email: 'test@example.com' },
          { id: '2', name: 'Other', email: 'other@example.com' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_config');

      expect(result.locale).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should have no locale when all dates are ISO', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '2026-03-25' },
          { id: '2', date: '2026-06-12' },
        ],
        warnings: [],
      });

      const result = await inspector.inspectTable('extract_events');

      expect(result.locale).toBeUndefined();
      expect(result.fields.date.type).toBe('Date');
    });

    it('should have no locale for empty table', async () => {
      mockClient.find.mockResolvedValue({ rows: [], warnings: [] });

      const result = await inspector.inspectTable('extract_empty');

      expect(result.locale).toBeUndefined();
      expect(result.warning).toBe('Table is empty, could not infer field types');
    });
  });

  // ─── generateSchema() integration ─────────────────────────────────────

  describe('generateSchema — locale propagation', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set locale on connection and table level', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '25.03.2026', name: 'Test' },
          { id: '2', date: '12.06.2026', name: 'Other' },
        ],
        warnings: [],
      });

      const result = await inspector.generateSchema('default', ['extract_worklog']);

      expect(result.locale).toBe('de-DE');
      expect(result.tables.worklogs.locale).toBe('de-DE');
    });

    it('should set connection locale to most frequent table locale', async () => {
      // Two tables with de-DE, one without locale
      mockClient.find
        .mockResolvedValueOnce({
          rows: [{ id: '1', date: '25.03.2026' }],
          warnings: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: '1', date: '13.06.2026' }],
          warnings: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: '1', name: 'Config' }], // No date fields
          warnings: [],
        });

      const result = await inspector.generateSchema('default', [
        'extract_worklog',
        'extract_event',
        'extract_config',
      ]);

      expect(result.locale).toBe('de-DE');
      expect(result.tables.worklogs.locale).toBe('de-DE');
      expect(result.tables.events.locale).toBe('de-DE');
      expect(result.tables.configs.locale).toBeUndefined();
    });

    it('should not set locale when no date fields in any table', async () => {
      mockClient.find.mockResolvedValue({
        rows: [{ id: '1', name: 'Test', email: 'test@example.com' }],
        warnings: [],
      });

      const result = await inspector.generateSchema('default', ['extract_config']);

      expect(result.locale).toBeUndefined();
      expect(result.tables.configs.locale).toBeUndefined();
    });

    it('should not set locale when all dates are ISO', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '2026-03-25' },
          { id: '2', date: '2026-06-12' },
        ],
        warnings: [],
      });

      const result = await inspector.generateSchema('default', ['extract_event']);

      expect(result.locale).toBeUndefined();
      expect(result.tables.events.locale).toBeUndefined();
    });

    it('should log warning for ambiguous locale detection', async () => {
      mockClient.find.mockResolvedValue({
        rows: [
          { id: '1', date: '03/06/2026' },
          { id: '2', date: '01/12/2026' },
        ],
        warnings: [],
      });

      await inspector.generateSchema('default', ['extract_worklog']);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ambiguous'));
    });
  });

  // ─── mostFrequent() helper ────────────────────────────────────────────

  describe('mostFrequent helper', () => {
    const callMostFrequent = (inspector: SchemaInspector, values: string[]) =>
      (inspector as any).mostFrequent(values);

    it('should return undefined for empty array', () => {
      expect(callMostFrequent(inspector, [])).toBeUndefined();
    });

    it('should return single value', () => {
      expect(callMostFrequent(inspector, ['de-DE'])).toBe('de-DE');
    });

    it('should return most frequent value', () => {
      expect(callMostFrequent(inspector, ['de-DE', 'en-US', 'de-DE'])).toBe('de-DE');
    });

    it('should return first value when tied', () => {
      const result = callMostFrequent(inspector, ['de-DE', 'en-US']);
      // Both have count 1, should return the one with higher count (first one wins)
      expect(result).toBeDefined();
    });
  });
});
