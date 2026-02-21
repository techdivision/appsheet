/**
 * Interface and types for AppSheet Selector building and escaping.
 *
 * AppSheet API requires selector expressions to use function wrappers
 * like Filter(), Select(), OrderBy(), Top() instead of raw boolean expressions.
 *
 * @see https://support.google.com/appsheet/answer/10105770
 * @module types
 * @category Types
 */

/**
 * Interface for building and processing AppSheet selector expressions.
 *
 * Implementations handle:
 * - Wrapping raw boolean expressions in Filter() for API compliance
 * - Escaping values to prevent injection attacks
 * - Building complete, safe selector expressions
 *
 * @category Types
 *
 * @example
 * ```typescript
 * // Use the default implementation
 * const builder: SelectorBuilderInterface = new SelectorBuilder();
 *
 * // Wrap a raw expression for API compliance
 * const selector = builder.ensureFunction('[Status] = "Active"', 'People');
 * // => 'Filter(People, [Status] = "Active")'
 *
 * // Build a safe filter with escaped values
 * const filter = builder.buildFilter('People', '[name]', 'O"Brien');
 * // => 'Filter(People, [name] = "O\"Brien")'
 * ```
 */
export interface SelectorBuilderInterface {
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
   */
  ensureFunction(selector: string, tableName: string): string;

  /**
   * Escape a string value for safe use in AppSheet filter expressions.
   *
   * Prevents injection attacks by escaping special characters:
   * - Backslash (`\`) is escaped to `\\`
   * - Double quote (`"`) is escaped to `\"`
   *
   * @param value - Raw string value (e.g. user input)
   * @returns Escaped string safe for use in filter expressions
   */
  escapeValue(value: string): string;

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
   */
  buildFilter(tableName: string, fieldName: string, value: string): string;

  /**
   * Validate that a table or field name contains only safe characters.
   *
   * Safe identifiers contain only alphanumeric characters and underscores.
   * Names with special characters should be wrapped in [brackets] when used
   * in AppSheet expressions.
   *
   * @param name - Table or field name to validate
   * @returns True if the name is safe (alphanumeric + underscore only)
   */
  isSafeIdentifier(name: string): boolean;
}
