/**
 * Unit tests for WriteConversionPolicy implementations
 *
 * Tests both built-in policies:
 * - NoOpWriteConversionPolicy (pass-through, default)
 * - LocaleWriteConversionPolicy (ISO → locale date conversion)
 *
 * @see docs/SOSO-440/FEATURE_CONCEPT.md
 */

import { NoOpWriteConversionPolicy } from '../../../src/utils/policies/NoOpWriteConversionPolicy';
import { LocaleWriteConversionPolicy } from '../../../src/utils/policies/LocaleWriteConversionPolicy';
import { FieldDefinition } from '../../../src/types';

// ============================================
// Shared test fixtures
// ============================================

const dateFields: Record<string, FieldDefinition> = {
  date: { type: 'Date' },
  name: { type: 'Text' },
};

const dateTimeFields: Record<string, FieldDefinition> = {
  created: { type: 'DateTime' },
  name: { type: 'Text' },
};

const changeTimestampFields: Record<string, FieldDefinition> = {
  modified: { type: 'ChangeTimestamp' },
};

const mixedFields: Record<string, FieldDefinition> = {
  id: { type: 'Text', required: true },
  date: { type: 'Date' },
  created: { type: 'DateTime' },
  modified: { type: 'ChangeTimestamp' },
  name: { type: 'Text' },
  count: { type: 'Number' },
};

// ============================================
// NoOpWriteConversionPolicy
// ============================================

describe('NoOpWriteConversionPolicy', () => {
  const policy = new NoOpWriteConversionPolicy();

  it('should return rows unchanged with locale', () => {
    const rows = [{ date: '2026-03-12', name: 'Test' }];
    const result = policy.apply('table', rows, dateFields, 'de-DE');
    expect(result).toEqual(rows);
  });

  it('should return rows unchanged without locale', () => {
    const rows = [{ date: '2026-03-12' }];
    const result = policy.apply('table', rows, dateFields);
    expect(result).toEqual(rows);
  });

  it('should return the exact same array reference', () => {
    const rows = [{ date: '2026-03-12' }];
    const result = policy.apply('table', rows, dateFields, 'de-DE');
    expect(result).toBe(rows);
  });

  it('should handle empty rows array', () => {
    const result = policy.apply('table', [], dateFields, 'de-DE');
    expect(result).toEqual([]);
  });
});

// ============================================
// LocaleWriteConversionPolicy — Date
// ============================================

describe('LocaleWriteConversionPolicy', () => {
  const policy = new LocaleWriteConversionPolicy();

  describe('Date conversion', () => {
    it('should convert ISO date to de-DE format', () => {
      const rows = [{ date: '2026-03-12', name: 'Test' }];
      const result = policy.apply('t', rows, dateFields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
      expect(result[0].name).toBe('Test'); // Non-date fields unchanged
    });

    it('should convert ISO date to en-US format', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, dateFields, 'en-US');
      expect(result[0].date).toBe('03/12/2026');
    });

    it('should convert ISO date to ja-JP format', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, dateFields, 'ja-JP');
      expect(result[0].date).toBe('2026/03/12');
    });

    it('should pass through non-ISO dates unchanged (round-trip)', () => {
      const rows = [{ date: '12.03.2026' }]; // Already in de-DE
      const result = policy.apply('t', rows, dateFields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
    });

    it('should pass through en-US locale dates unchanged (round-trip)', () => {
      const rows = [{ date: '03/11/2026' }]; // Already in en-US
      const result = policy.apply('t', rows, dateFields, 'en-US');
      expect(result[0].date).toBe('03/11/2026');
    });

    it('should pass through ja-JP locale dates unchanged (round-trip)', () => {
      const rows = [{ date: '2026/03/11' }]; // Already in ja-JP
      const result = policy.apply('t', rows, dateFields, 'ja-JP');
      expect(result[0].date).toBe('2026/03/11');
    });

    it('should not mutate original rows', () => {
      const rows = [{ date: '2026-03-12', name: 'Test' }];
      const original = { ...rows[0] };
      policy.apply('t', rows, dateFields, 'de-DE');
      expect(rows[0]).toEqual(original);
    });
  });

  // ============================================
  // DateTime conversion
  // ============================================

  describe('DateTime conversion', () => {
    it('should convert ISO datetime with Z timezone to de-DE', () => {
      const rows = [{ created: '2026-03-12T14:30:00.000Z' }];
      const result = policy.apply('t', rows, dateTimeFields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should convert ISO datetime with Z timezone to en-US', () => {
      const rows = [{ created: '2026-03-12T14:30:00Z' }];
      const result = policy.apply('t', rows, dateTimeFields, 'en-US');
      expect(result[0].created).toBe('03/12/2026 14:30:00');
    });

    it('should convert ISO datetime with offset timezone', () => {
      const rows = [{ created: '2026-03-12T14:30:00+02:00' }];
      const result = policy.apply('t', rows, dateTimeFields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should convert ISO datetime without timezone', () => {
      const rows = [{ created: '2026-03-12T14:30:00' }];
      const result = policy.apply('t', rows, dateTimeFields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should convert ISO datetime with milliseconds', () => {
      const rows = [{ created: '2026-03-12T14:30:00.123Z' }];
      const result = policy.apply('t', rows, dateTimeFields, 'en-US');
      expect(result[0].created).toBe('03/12/2026 14:30:00');
    });

    it('should pass through locale datetimes unchanged (round-trip de-DE)', () => {
      const rows = [{ created: '12.03.2026 14:30:00' }];
      const result = policy.apply('t', rows, dateTimeFields, 'de-DE');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
    });

    it('should pass through locale datetimes unchanged (round-trip en-US)', () => {
      const rows = [{ created: '03/11/2026 21:51:24' }];
      const result = policy.apply('t', rows, dateTimeFields, 'en-US');
      expect(result[0].created).toBe('03/11/2026 21:51:24');
    });
  });

  // ============================================
  // ChangeTimestamp conversion
  // ============================================

  describe('ChangeTimestamp conversion', () => {
    it('should convert ChangeTimestamp like DateTime', () => {
      const rows = [{ modified: '2026-03-12T14:30:00Z' }];
      const result = policy.apply('t', rows, changeTimestampFields, 'de-DE');
      expect(result[0].modified).toBe('12.03.2026 14:30:00');
    });

    it('should pass through locale ChangeTimestamp unchanged (round-trip)', () => {
      const rows = [{ modified: '12.03.2026 14:30:00' }];
      const result = policy.apply('t', rows, changeTimestampFields, 'de-DE');
      expect(result[0].modified).toBe('12.03.2026 14:30:00');
    });
  });

  // ============================================
  // Without locale (no-op behavior)
  // ============================================

  describe('without locale', () => {
    it('should act as no-op without locale', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, dateFields);
      expect(result[0].date).toBe('2026-03-12');
    });

    it('should act as no-op with undefined locale', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, dateFields, undefined);
      expect(result[0].date).toBe('2026-03-12');
    });

    it('should return the exact same array reference without locale', () => {
      const rows = [{ date: '2026-03-12' }];
      const result = policy.apply('t', rows, dateFields);
      expect(result).toBe(rows);
    });
  });

  // ============================================
  // Non-date fields
  // ============================================

  describe('non-date fields', () => {
    it('should not touch Text fields', () => {
      const fields: Record<string, FieldDefinition> = {
        name: { type: 'Text' },
        count: { type: 'Number' },
      };
      const rows = [{ name: 'Test', count: 42 }];
      const result = policy.apply('t', rows, fields, 'de-DE');
      expect(result).toEqual(rows);
    });

    it('should handle null/undefined date values', () => {
      const rows = [{ date: undefined }, { date: null }];
      const result = policy.apply('t', rows as any, dateFields, 'de-DE');
      expect(result[0].date).toBeUndefined();
      expect(result[1].date).toBeNull();
    });

    it('should handle numeric date values (not string)', () => {
      const rows = [{ date: 12345 }];
      const result = policy.apply('t', rows as any, dateFields, 'de-DE');
      expect(result[0].date).toBe(12345); // Not a string, pass through
    });
  });

  // ============================================
  // Multiple rows
  // ============================================

  describe('multiple rows', () => {
    it('should convert all ISO rows and pass through locale rows', () => {
      const rows = [
        { date: '2026-03-12' }, // ISO → convert
        { date: '2026-12-25' }, // ISO → convert
        { date: '12.03.2026' }, // Already locale → pass through
      ];
      const result = policy.apply('t', rows, dateFields, 'de-DE');
      expect(result[0].date).toBe('12.03.2026');
      expect(result[1].date).toBe('25.12.2026');
      expect(result[2].date).toBe('12.03.2026');
    });
  });

  // ============================================
  // Mixed field types
  // ============================================

  describe('mixed field types', () => {
    it('should convert only date/datetime fields in a mixed row', () => {
      const rows = [
        {
          id: '1',
          date: '2026-03-12',
          created: '2026-03-12T14:30:00Z',
          modified: '2026-03-12T09:00:00.000Z',
          name: 'Test',
          count: 42,
        },
      ];
      const result = policy.apply('t', rows, mixedFields, 'de-DE');
      expect(result[0].id).toBe('1');
      expect(result[0].date).toBe('12.03.2026');
      expect(result[0].created).toBe('12.03.2026 14:30:00');
      expect(result[0].modified).toBe('12.03.2026 09:00:00');
      expect(result[0].name).toBe('Test');
      expect(result[0].count).toBe(42);
    });
  });

  // ============================================
  // Empty rows
  // ============================================

  describe('edge cases', () => {
    it('should handle empty rows array', () => {
      const result = policy.apply('t', [], dateFields, 'de-DE');
      expect(result).toEqual([]);
    });

    it('should handle rows with no matching date fields', () => {
      const rows = [{ name: 'Test' }];
      const result = policy.apply('t', rows, dateFields, 'de-DE');
      expect(result[0].name).toBe('Test');
    });

    it('should handle empty row objects', () => {
      const rows = [{}];
      const result = policy.apply('t', rows, dateFields, 'de-DE');
      expect(result).toEqual([{}]);
    });
  });
});
