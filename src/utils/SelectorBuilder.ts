/**
 * AppSheet Selector Builder
 *
 * Builds and processes AppSheet selector expressions for API compliance
 * and injection safety.
 *
 * The AppSheet API requires that the `Properties.Selector` field contains
 * a function expression like `Filter()`, `Select()`, `OrderBy()`, or `Top()`.
 * Raw boolean expressions like `[Field] = "value"` are not part of the
 * documented API contract, even though the API currently tolerates them.
 *
 * This class ensures selectors are always spec-compliant and values are
 * properly escaped against injection attacks.
 *
 * @see https://support.google.com/appsheet/answer/10105770
 * @module utils
 * @category Utilities
 */

import { SelectorBuilderInterface } from '../types';

/**
 * Recognized AppSheet selector functions.
 *
 * These are the only function prefixes that the AppSheet API documents
 * as valid Selector values for Find operations.
 *
 * @see https://support.google.com/appsheet/answer/10105770
 */
const SELECTOR_FUNCTIONS = ['Filter(', 'Select(', 'OrderBy(', 'Top('];

/**
 * Default implementation of the SelectorBuilder.
 *
 * Provides methods for:
 * - Wrapping raw boolean expressions in `Filter()` (API compliance)
 * - Escaping string values against injection attacks (security)
 * - Building complete, safe filter expressions (convenience)
 * - Validating identifier names (safety check)
 *
 * @category Utilities
 *
 * @example
 * ```typescript
 * const selector = new SelectorBuilder();
 *
 * // Ensure API compliance
 * selector.ensureFunction('[Status] = "Active"', 'People');
 * // => 'Filter(People, [Status] = "Active")'
 *
 * // Build safe filter from user input
 * selector.buildFilter('People', '[name]', userInput);
 * // => 'Filter(People, [name] = "escaped-value")'
 *
 * // Escape a value for manual expression building
 * const safe = selector.escapeValue('O"Brien');
 * // => 'O\\"Brien'
 * ```
 */
export class SelectorBuilder implements SelectorBuilderInterface {
  /**
   * Ensure a selector expression is wrapped in a valid AppSheet function.
   *
   * If the selector already starts with a recognized function (Filter, Select,
   * OrderBy, Top), it is returned as-is (idempotent).
   *
   * If the selector is a raw boolean expression (e.g. `[Field] = "value"`),
   * it is wrapped in `Filter(tableName, expression)`.
   *
   * @param selector - The selector expression to process
   * @param tableName - The AppSheet table name for the Filter() wrapper
   * @returns A valid selector expression wrapped in a function
   *
   * @example
   * ```typescript
   * const builder = new SelectorBuilder();
   *
   * // Raw expression gets wrapped
   * builder.ensureFunction('[Status] = "Active"', 'People');
   * // => 'Filter(People, [Status] = "Active")'
   *
   * // Already wrapped expression is returned as-is
   * builder.ensureFunction('Filter(People, [Status] = "Active")', 'People');
   * // => 'Filter(People, [Status] = "Active")'
   *
   * // Other functions are also recognized
   * builder.ensureFunction('OrderBy(Filter(People, true), [Name], true)', 'People');
   * // => 'OrderBy(Filter(People, true), [Name], true)'
   * ```
   */
  ensureFunction(selector: string, tableName: string): string {
    const trimmed = selector.trim();

    const alreadyWrapped = SELECTOR_FUNCTIONS.some((fn) => trimmed.startsWith(fn));

    if (alreadyWrapped) {
      return trimmed;
    }

    return `Filter(${tableName}, ${trimmed})`;
  }

  /**
   * Escape a string value for safe use in AppSheet filter expressions.
   *
   * Prevents injection attacks by escaping special characters:
   * - Backslash (`\`) is escaped to `\\` (must be escaped first)
   * - Double quote (`"`) is escaped to `\"`
   *
   * @param value - Raw string value (e.g. user input)
   * @returns Escaped string safe for use in filter expressions
   * @throws {TypeError} If value is not a string
   *
   * @example
   * ```typescript
   * const builder = new SelectorBuilder();
   *
   * builder.escapeValue('normal');        // => 'normal'
   * builder.escapeValue('O"Brien');       // => 'O\\"Brien'
   * builder.escapeValue('C:\\path');      // => 'C:\\\\path'
   *
   * // Prevents injection
   * builder.escapeValue('123" OR "1"="1');
   * // => '123\\" OR \\"1\\"=\\"1'
   * ```
   */
  escapeValue(value: string): string {
    if (typeof value !== 'string') {
      throw new TypeError('escapeValue: value must be a string');
    }

    return (
      value
        // Step 1: Escape backslashes first (before escaping quotes)
        .replace(/\\/g, '\\\\')
        // Step 2: Escape double quotes
        .replace(/"/g, '\\"')
    );
  }

  /**
   * Build a complete, safe Filter() expression for an exact field match.
   *
   * Combines value escaping with Filter() wrapping. Use this when constructing
   * selectors from user input to prevent injection attacks.
   *
   * @param tableName - AppSheet table name
   * @param fieldName - Field name in bracket notation (e.g. `[user_id]`)
   * @param value - Raw value to match (will be escaped)
   * @returns Complete Filter() expression with escaped value
   *
   * @example
   * ```typescript
   * const builder = new SelectorBuilder();
   *
   * builder.buildFilter('users', '[user_id]', '123');
   * // => 'Filter(users, [user_id] = "123")'
   *
   * // Injection-safe with user input
   * builder.buildFilter('users', '[user_id]', '123" OR "1"="1');
   * // => 'Filter(users, [user_id] = "123\\" OR \\"1\\"=\\"1")'
   * ```
   */
  buildFilter(tableName: string, fieldName: string, value: string): string {
    const escapedValue = this.escapeValue(value);
    return `Filter(${tableName}, ${fieldName} = "${escapedValue}")`;
  }

  /**
   * Validate that a table or field name contains only safe characters.
   *
   * Safe identifiers contain only alphanumeric characters and underscores.
   * Names with special characters should be wrapped in [brackets] when used
   * in AppSheet expressions.
   *
   * @param name - Table or field name to validate
   * @returns True if the name is safe (alphanumeric + underscore only)
   *
   * @example
   * ```typescript
   * const builder = new SelectorBuilder();
   *
   * builder.isSafeIdentifier('users');      // => true
   * builder.isSafeIdentifier('user_id');    // => true
   * builder.isSafeIdentifier('user-id');    // => false
   * builder.isSafeIdentifier('user id');    // => false
   * ```
   */
  isSafeIdentifier(name: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(name);
  }
}
