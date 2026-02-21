/**
 * SelectorBuilder Tests
 *
 * Tests for AppSheet selector building, wrapping, and injection prevention.
 *
 * @see SOSO-365: AppSheet API Selector-Fix + Default-URL Korrektur
 * @see https://support.google.com/appsheet/answer/10105770
 */

import { SelectorBuilder } from '../../src/utils/SelectorBuilder';
import { SelectorBuilderInterface } from '../../src/types';

describe('SelectorBuilder', () => {
  let builder: SelectorBuilderInterface;

  beforeEach(() => {
    builder = new SelectorBuilder();
  });

  it('should implement SelectorBuilderInterface', () => {
    expect(builder).toBeDefined();
    expect(builder.ensureFunction).toBeDefined();
    expect(builder.escapeValue).toBeDefined();
    expect(builder.buildFilter).toBeDefined();
    expect(builder.isSafeIdentifier).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────
  // ensureFunction()
  // ────────────────────────────────────────────────────────────────────

  describe('ensureFunction', () => {
    const tableName = 'People';

    describe('wrapping raw boolean expressions', () => {
      it('should wrap a simple equality expression', () => {
        expect(builder.ensureFunction('[Status] = "Active"', tableName)).toBe(
          'Filter(People, [Status] = "Active")'
        );
      });

      it('should wrap a compound AND expression', () => {
        expect(builder.ensureFunction('[Age] >= 21 AND [State] = "CA"', tableName)).toBe(
          'Filter(People, [Age] >= 21 AND [State] = "CA")'
        );
      });

      it('should wrap an IN expression', () => {
        expect(builder.ensureFunction('[Status] IN ("Active", "Pending")', tableName)).toBe(
          'Filter(People, [Status] IN ("Active", "Pending"))'
        );
      });

      it('should wrap a NOT expression', () => {
        expect(builder.ensureFunction('NOT([Status] = "Deleted")', tableName)).toBe(
          'Filter(People, NOT([Status] = "Deleted"))'
        );
      });

      it('should trim leading and trailing whitespace', () => {
        expect(builder.ensureFunction('  [Status] = "Active"  ', tableName)).toBe(
          'Filter(People, [Status] = "Active")'
        );
      });

      it('should use the provided table name in the wrapper', () => {
        expect(builder.ensureFunction('[id] = "1"', 'extract_user')).toBe(
          'Filter(extract_user, [id] = "1")'
        );
      });
    });

    describe('idempotency - already wrapped expressions', () => {
      it('should not double-wrap Filter()', () => {
        const selector = 'Filter(People, [Status] = "Active")';
        expect(builder.ensureFunction(selector, tableName)).toBe(selector);
      });

      it('should not wrap Select()', () => {
        const selector = 'Select(People[_ComputedKey], [Age] >= 21, true)';
        expect(builder.ensureFunction(selector, tableName)).toBe(selector);
      });

      it('should not wrap OrderBy()', () => {
        const selector = 'OrderBy(Filter(People, [Age] >= 21), [LastName], true)';
        expect(builder.ensureFunction(selector, tableName)).toBe(selector);
      });

      it('should not wrap Top()', () => {
        const selector = 'Top(OrderBy(Filter(People, true), [Name], true), 10)';
        expect(builder.ensureFunction(selector, tableName)).toBe(selector);
      });

      it('should handle Filter() with leading whitespace (trimmed)', () => {
        const selector = '  Filter(People, [Status] = "Active")  ';
        expect(builder.ensureFunction(selector, tableName)).toBe(
          'Filter(People, [Status] = "Active")'
        );
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // escapeValue()
  // ────────────────────────────────────────────────────────────────────

  describe('escapeValue', () => {
    describe('normal values (no escaping needed)', () => {
      it('should pass through simple alphanumeric strings', () => {
        expect(builder.escapeValue('abc123')).toBe('abc123');
        expect(builder.escapeValue('test')).toBe('test');
        expect(builder.escapeValue('550e8400-e29b-41d4-a716-446655440000')).toBe(
          '550e8400-e29b-41d4-a716-446655440000'
        );
      });

      it('should pass through strings with spaces', () => {
        expect(builder.escapeValue('hello world')).toBe('hello world');
        expect(builder.escapeValue('Service Portfolio')).toBe('Service Portfolio');
      });

      it('should pass through strings with common punctuation', () => {
        expect(builder.escapeValue('hello, world!')).toBe('hello, world!');
        expect(builder.escapeValue('test@example.com')).toBe('test@example.com');
      });
    });

    describe('special character escaping', () => {
      it('should escape double quotes', () => {
        expect(builder.escapeValue('hello"world')).toBe('hello\\"world');
        expect(builder.escapeValue('"quoted"')).toBe('\\"quoted\\"');
        expect(builder.escapeValue('say "hello"')).toBe('say \\"hello\\"');
      });

      it('should escape backslashes', () => {
        expect(builder.escapeValue('C:\\path\\to\\file')).toBe('C:\\\\path\\\\to\\\\file');
        expect(builder.escapeValue('test\\value')).toBe('test\\\\value');
      });

      it('should escape backslashes before quotes (correct order)', () => {
        expect(builder.escapeValue('test\\"value')).toBe('test\\\\\\"value');
        expect(builder.escapeValue('path\\"file"')).toBe('path\\\\\\"file\\"');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(builder.escapeValue('')).toBe('');
      });

      it('should handle string with only quotes', () => {
        expect(builder.escapeValue('"')).toBe('\\"');
      });

      it('should handle string with only backslashes', () => {
        expect(builder.escapeValue('\\')).toBe('\\\\');
      });

      it('should throw TypeError for non-string values', () => {
        // @ts-expect-error Testing runtime error handling
        expect(() => builder.escapeValue(123)).toThrow(TypeError);
        // @ts-expect-error Testing runtime error handling
        expect(() => builder.escapeValue(null)).toThrow(TypeError);
        // @ts-expect-error Testing runtime error handling
        expect(() => builder.escapeValue(undefined)).toThrow(TypeError);
      });
    });

    describe('injection attack prevention', () => {
      it('should prevent OR condition injection', () => {
        const maliciousId = '123" OR "1"="1';
        const escaped = builder.escapeValue(maliciousId);
        expect(escaped).toBe('123\\" OR \\"1\\"=\\"1');
      });

      it('should prevent function call injection', () => {
        const maliciousId = '123") OR ISBLANK([field])=FALSE OR ([id]="';
        const escaped = builder.escapeValue(maliciousId);
        expect(escaped).toBe('123\\") OR ISBLANK([field])=FALSE OR ([id]=\\"');
      });

      it('should prevent comment injection', () => {
        const maliciousId = '123" -- ignore rest';
        const escaped = builder.escapeValue(maliciousId);
        expect(escaped).toBe('123\\" -- ignore rest');
      });

      it('should prevent backslash encoding bypass', () => {
        const maliciousId = '1\\"; OR "1"="1';
        const escaped = builder.escapeValue(maliciousId);
        // Backslash escaped first, then quote escaped
        expect(escaped).toContain('\\\\');
        expect(escaped).toContain('\\"');
      });

      it('should prevent complex nested injection', () => {
        const maliciousId = '123") OR (SELECT([field], [table]) = "malicious';
        const escaped = builder.escapeValue(maliciousId);
        expect(escaped).toBe('123\\") OR (SELECT([field], [table]) = \\"malicious');
      });
    });

    describe('comprehensive injection payloads', () => {
      const injectionPayloads = [
        { input: '" OR "1"="1', description: 'Double quote OR injection' },
        { input: '1" UNION SELECT * FROM users WHERE "1"="1', description: 'UNION injection' },
        {
          input: '1") OR ISBLANK([password])=FALSE OR ("1"="1',
          description: 'ISBLANK function injection',
        },
        {
          input: '1") OR COUNT(SELECT([id], [users])) > 0 OR ("1"="1',
          description: 'COUNT/SELECT injection',
        },
        { input: '1" -- ignore rest', description: 'SQL comment injection' },
        { input: '1" /* comment */ OR "1"="1', description: 'Block comment injection' },
        { input: '1\\"; OR "1"="1', description: 'Backslash encoding bypass' },
        { input: '1\\\"; OR "1"="1', description: 'Double backslash bypass' },
      ];

      injectionPayloads.forEach(({ input, description }) => {
        it(`should neutralize: ${description}`, () => {
          const escaped = builder.escapeValue(input);
          const filter = `Filter(table, [id] = "${escaped}")`;

          // No unescaped quotes should remain inside the filter value
          const innerContent = filter.match(/Filter\(table, \[id\] = "(.*?)"\)/)?.[1] || '';
          expect(innerContent).not.toMatch(/[^\\]"/);

          expect(filter).toContain(escaped);
        });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // buildFilter()
  // ────────────────────────────────────────────────────────────────────

  describe('buildFilter', () => {
    it('should build correct filter expression for simple values', () => {
      expect(builder.buildFilter('users', '[user_id]', '123')).toBe(
        'Filter(users, [user_id] = "123")'
      );
    });

    it('should escape values in filter expression', () => {
      expect(builder.buildFilter('users', '[user_id]', '123" OR "1"="1')).toBe(
        'Filter(users, [user_id] = "123\\" OR \\"1\\"=\\"1")'
      );
    });

    it('should handle field names with brackets', () => {
      expect(builder.buildFilter('service_portfolio', '[service_portfolio_id]', 'abc123')).toBe(
        'Filter(service_portfolio, [service_portfolio_id] = "abc123")'
      );
    });

    it('should work with UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(builder.buildFilter('users', '[id]', uuid)).toBe(`Filter(users, [id] = "${uuid}")`);
    });

    it('should handle empty string value', () => {
      expect(builder.buildFilter('users', '[name]', '')).toBe('Filter(users, [name] = "")');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // isSafeIdentifier()
  // ────────────────────────────────────────────────────────────────────

  describe('isSafeIdentifier', () => {
    it('should accept alphanumeric identifiers', () => {
      expect(builder.isSafeIdentifier('users')).toBe(true);
      expect(builder.isSafeIdentifier('user_id')).toBe(true);
      expect(builder.isSafeIdentifier('table123')).toBe(true);
      expect(builder.isSafeIdentifier('TABLE_NAME')).toBe(true);
    });

    it('should reject identifiers with special characters', () => {
      expect(builder.isSafeIdentifier('user-id')).toBe(false);
      expect(builder.isSafeIdentifier('user.id')).toBe(false);
      expect(builder.isSafeIdentifier('user id')).toBe(false);
      expect(builder.isSafeIdentifier('user[id]')).toBe(false);
      expect(builder.isSafeIdentifier('user;id')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(builder.isSafeIdentifier('')).toBe(false);
    });
  });
});
