/**
 * Tests for locale-aware date/datetime validation in FormatValidator
 * @see docs/SOSO-439/BUGFIX_CONCEPT.md
 */

import {
  FormatValidator,
  getLocaleDateFormat,
} from '../../../src/utils/validators/FormatValidator';
import { ValidationError } from '../../../src/types';

// ============================================
// getLocaleDateFormat() unit tests
// ============================================

describe('getLocaleDateFormat', () => {
  it('should detect en-US as MDY with / separator', () => {
    const fmt = getLocaleDateFormat('en-US');
    expect(fmt.partOrder).toEqual(['month', 'day', 'year']);
    expect(fmt.separator).toBe('/');
  });

  it('should detect de-DE as DMY with . separator', () => {
    const fmt = getLocaleDateFormat('de-DE');
    expect(fmt.partOrder).toEqual(['day', 'month', 'year']);
    expect(fmt.separator).toBe('.');
  });

  it('should detect ja-JP as YMD with / separator', () => {
    const fmt = getLocaleDateFormat('ja-JP');
    expect(fmt.partOrder).toEqual(['year', 'month', 'day']);
    expect(fmt.separator).toBe('/');
  });

  it('should detect en-GB as DMY with / separator', () => {
    const fmt = getLocaleDateFormat('en-GB');
    expect(fmt.partOrder).toEqual(['day', 'month', 'year']);
    expect(fmt.separator).toBe('/');
  });

  it('should cache results (same object returned)', () => {
    const fmt1 = getLocaleDateFormat('en-US');
    const fmt2 = getLocaleDateFormat('en-US');
    expect(fmt1).toBe(fmt2); // Exact same reference
  });

  it('should provide example date in locale format', () => {
    const fmt = getLocaleDateFormat('de-DE');
    expect(fmt.exampleDate).toBe('25.12.2026');
  });

  it('should provide example date for en-US', () => {
    const fmt = getLocaleDateFormat('en-US');
    expect(fmt.exampleDate).toBe('12/25/2026');
  });

  it('should provide example datetime string', () => {
    const fmt = getLocaleDateFormat('de-DE');
    // Should contain date and time parts
    expect(fmt.exampleDateTime).toContain('25.12.2026');
    expect(fmt.exampleDateTime).toContain('14');
    expect(fmt.exampleDateTime).toContain('30');
  });
});

// ============================================
// FormatValidator.validateDateFormat() with locale
// ============================================

describe('FormatValidator - Locale-aware Date validation', () => {
  describe('with locale en-US', () => {
    it('should accept MM/DD/YYYY', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0, 'en-US')).not.toThrow();
    });

    it('should accept single-digit month/day (3/11/2026)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '3/11/2026', 0, 'en-US')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'en-US')).not.toThrow();
    });

    it('should reject DD.MM.YYYY (de-DE format)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0, 'en-US')).toThrow(
        ValidationError
      );
    });

    it('should show locale example in error message', () => {
      try {
        FormatValidator.validateDateFormat('d', 'invalid', 0, 'en-US');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('12/25/2026');
        expect(error.message).toContain('YYYY-MM-DD');
      }
    });
  });

  describe('with locale de-DE', () => {
    it('should accept DD.MM.YYYY', () => {
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0, 'de-DE')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'de-DE')).not.toThrow();
    });

    it('should reject MM/DD/YYYY (en-US format)', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0, 'de-DE')).toThrow(
        ValidationError
      );
    });
  });

  describe('with locale en-GB', () => {
    it('should accept DD/MM/YYYY', () => {
      expect(() => FormatValidator.validateDateFormat('d', '11/03/2026', 0, 'en-GB')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'en-GB')).not.toThrow();
    });
  });

  describe('with locale ja-JP (auto-detected via Intl)', () => {
    it('should accept YYYY/MM/DD', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026/03/11', 0, 'ja-JP')).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0, 'ja-JP')).not.toThrow();
    });
  });

  describe('without locale (permissive)', () => {
    it('should accept any plausible date format', () => {
      expect(() => FormatValidator.validateDateFormat('d', '03/11/2026', 0)).not.toThrow();
      expect(() => FormatValidator.validateDateFormat('d', '11.03.2026', 0)).not.toThrow();
      expect(() => FormatValidator.validateDateFormat('d', '2026-03-11', 0)).not.toThrow();
      expect(() => FormatValidator.validateDateFormat('d', '2026/03/11', 0)).not.toThrow();
    });

    it('should reject obviously invalid strings', () => {
      expect(() => FormatValidator.validateDateFormat('d', 'not-a-date', 0)).toThrow(
        ValidationError
      );
    });

    it('should reject empty string', () => {
      expect(() => FormatValidator.validateDateFormat('d', '', 0)).toThrow(ValidationError);
    });

    it('should reject string with wrong number of parts', () => {
      expect(() => FormatValidator.validateDateFormat('d', '2026/03', 0)).toThrow(ValidationError);
    });
  });

  describe('semantic validation with locale', () => {
    it('should reject month > 12', () => {
      // en-US format: MM/DD/YYYY → 13 is not a valid month
      expect(() => FormatValidator.validateDateFormat('d', '13/01/2026', 0, 'en-US')).toThrow(
        ValidationError
      );
    });

    it('should reject day > 31', () => {
      // en-US format: MM/DD/YYYY → 32 is not a valid day
      expect(() => FormatValidator.validateDateFormat('d', '01/32/2026', 0, 'en-US')).toThrow(
        ValidationError
      );
    });

    it('should reject year < 1900', () => {
      expect(() => FormatValidator.validateDateFormat('d', '01/01/1899', 0, 'en-US')).toThrow(
        ValidationError
      );
    });
  });
});

// ============================================
// FormatValidator.validateDateTimeFormat() with locale
// ============================================

describe('FormatValidator - Locale-aware DateTime validation', () => {
  describe('with locale en-US', () => {
    it('should accept MM/DD/YYYY HH:mm:ss', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51:24', 0, 'en-US')
      ).not.toThrow();
    });

    it('should accept MM/DD/YYYY HH:mm (without seconds)', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51', 0, 'en-US')
      ).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026-03-11T21:51:24.000Z', 0, 'en-US')
      ).not.toThrow();
    });

    it('should reject DD.MM.YYYY HH:mm:ss (de-DE format)', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51:24', 0, 'en-US')
      ).toThrow(ValidationError);
    });

    it('should show locale example in error message', () => {
      try {
        FormatValidator.validateDateTimeFormat('dt', 'invalid', 0, 'en-US');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('ISO 8601');
      }
    });
  });

  describe('with locale de-DE', () => {
    it('should accept DD.MM.YYYY HH:mm:ss', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51:24', 0, 'de-DE')
      ).not.toThrow();
    });

    it('should accept DD.MM.YYYY HH:mm (without seconds)', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51', 0, 'de-DE')
      ).not.toThrow();
    });

    it('should accept ISO 8601 as fallback', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026-03-11T21:51:24', 0, 'de-DE')
      ).not.toThrow();
    });

    it('should reject MM/DD/YYYY HH:mm:ss (en-US format)', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51:24', 0, 'de-DE')
      ).toThrow(ValidationError);
    });
  });

  describe('with locale ja-JP', () => {
    it('should accept YYYY/MM/DD HH:mm:ss', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026/03/11 21:51:24', 0, 'ja-JP')
      ).not.toThrow();
    });
  });

  describe('without locale (permissive)', () => {
    it('should accept any plausible datetime format', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '03/11/2026 21:51:24', 0)
      ).not.toThrow();
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '11.03.2026 21:51:24', 0)
      ).not.toThrow();
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026-03-11 21:51:24', 0)
      ).not.toThrow();
    });

    it('should accept ISO 8601', () => {
      expect(() =>
        FormatValidator.validateDateTimeFormat('dt', '2026-03-11T21:51:24.000Z', 0)
      ).not.toThrow();
    });

    it('should reject obviously invalid strings', () => {
      expect(() => FormatValidator.validateDateTimeFormat('dt', 'not-a-datetime', 0)).toThrow(
        ValidationError
      );
    });

    it('should reject date without time', () => {
      expect(() => FormatValidator.validateDateTimeFormat('dt', '2026-03-11', 0)).toThrow(
        ValidationError
      );
    });
  });
});
