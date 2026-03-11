/**
 * Unit tests for UnknownFieldPolicy implementations
 *
 * Tests all 3 built-in policies:
 * - IgnoreUnknownFieldPolicy (pass-through)
 * - StripUnknownFieldPolicy (default, removes unknown fields)
 * - ErrorUnknownFieldPolicy (throws ValidationError)
 *
 * @see docs/SOSO-435/INTEGRATION_CONCEPT.md
 */

import { IgnoreUnknownFieldPolicy } from '../../../src/utils/policies/IgnoreUnknownFieldPolicy';
import { StripUnknownFieldPolicy } from '../../../src/utils/policies/StripUnknownFieldPolicy';
import { ErrorUnknownFieldPolicy } from '../../../src/utils/policies/ErrorUnknownFieldPolicy';
import { ValidationError } from '../../../src/types';

describe('IgnoreUnknownFieldPolicy', () => {
  const policy = new IgnoreUnknownFieldPolicy();

  it('should return rows unchanged', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
    expect(result[0]).toHaveProperty('unknown_field');
  });

  it('should return the exact same array reference', () => {
    const rows = [{ solution_id: '1', extra: 'val' }];
    const result = policy.apply('solution', rows, ['solution_id']);
    expect(result).toBe(rows);
  });

  it('should handle empty rows array', () => {
    const result = policy.apply('solution', [], ['solution_id']);
    expect(result).toEqual([]);
  });

  it('should handle rows with only known fields', () => {
    const rows = [{ solution_id: '1', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
  });
});

describe('StripUnknownFieldPolicy', () => {
  const policy = new StripUnknownFieldPolicy();

  it('should remove unknown fields', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result[0]).toEqual({ solution_id: '1', name: 'Test' });
    expect(result[0]).not.toHaveProperty('unknown_field');
  });

  it('should return rows unchanged if no unknown fields', () => {
    const rows = [{ solution_id: '1', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
  });

  it('should handle empty rows', () => {
    const result = policy.apply('solution', [{}], ['solution_id']);
    expect(result).toEqual([{}]);
  });

  it('should handle multiple rows', () => {
    const rows: Record<string, string>[] = [
      { solution_id: '1', bad: 'x' },
      { solution_id: '2', bad: 'y', name: 'Ok' },
    ];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result[0]).toEqual({ solution_id: '1' });
    expect(result[1]).toEqual({ solution_id: '2', name: 'Ok' });
  });

  it('should handle rows with only unknown fields', () => {
    const rows = [{ bad1: 'x', bad2: 'y' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result[0]).toEqual({});
  });

  it('should not modify the original row objects', () => {
    const originalRow = { solution_id: '1', unknown: 'value' };
    const rows = [originalRow];
    policy.apply('solution', rows, ['solution_id']);
    // Original row should still have the unknown field
    expect(originalRow).toHaveProperty('unknown');
  });
});

describe('ErrorUnknownFieldPolicy', () => {
  const policy = new ErrorUnknownFieldPolicy();

  it('should throw ValidationError for unknown fields', () => {
    const rows = [{ solution_id: '1', unknown_field: 'value' }];
    expect(() => policy.apply('solution', rows, ['solution_id', 'name'])).toThrow(ValidationError);
  });

  it('should include field names and row index in error', () => {
    const rows: Record<string, string>[] = [{ solution_id: '1' }, { solution_id: '2', bad: 'x' }];
    expect(() => policy.apply('solution', rows, ['solution_id', 'name'])).toThrow(/row 1/);
  });

  it('should include the unknown field name in error message', () => {
    const rows = [{ solution_id: '1', bad_field: 'x' }];
    expect(() => policy.apply('solution', rows, ['solution_id'])).toThrow(/bad_field/);
  });

  it('should include the table name in error message', () => {
    const rows = [{ solution_id: '1', bad: 'x' }];
    expect(() => policy.apply('solution', rows, ['solution_id'])).toThrow(/solution/);
  });

  it('should return rows unchanged if no unknown fields', () => {
    const rows = [{ solution_id: '1', name: 'Test' }];
    const result = policy.apply('solution', rows, ['solution_id', 'name']);
    expect(result).toEqual(rows);
  });

  it('should return the exact same array reference when valid', () => {
    const rows = [{ solution_id: '1' }];
    const result = policy.apply('solution', rows, ['solution_id']);
    expect(result).toBe(rows);
  });

  it('should report multiple unknown fields', () => {
    const rows = [{ solution_id: '1', bad1: 'x', bad2: 'y' }];
    expect(() => policy.apply('solution', rows, ['solution_id'])).toThrow(/bad1/);
    expect(() => policy.apply('solution', rows, ['solution_id'])).toThrow(/bad2/);
  });

  it('should throw on the first row with unknown fields', () => {
    const rows: Record<string, string>[] = [
      { solution_id: '1' },
      { solution_id: '2', bad: 'x' },
      { solution_id: '3', bad: 'y' },
    ];
    // Should throw for row 1 (0-indexed), not row 2
    expect(() => policy.apply('solution', rows, ['solution_id'])).toThrow(/row 1/);
  });

  it('should handle empty rows array', () => {
    const result = policy.apply('solution', [], ['solution_id']);
    expect(result).toEqual([]);
  });
});
