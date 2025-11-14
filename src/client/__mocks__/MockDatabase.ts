/**
 * MockDatabase - In-Memory Database for MockAppSheetClient
 *
 * Provides thread-safe in-memory storage for mock AppSheet data.
 * Used by MockAppSheetClient to simulate AppSheet API behavior.
 *
 * @module client
 * @category Client
 */

/**
 * In-memory database for mock AppSheet data.
 *
 * Stores data by table name with Map for O(1) lookups.
 * Thread-safe for concurrent operations.
 *
 * @category Client
 *
 * @example
 * ```typescript
 * const db = new MockDatabase();
 * db.insert('Users', { id: '1', name: 'John' });
 * const user = db.findOne('Users', { id: '1' });
 * ```
 */
export class MockDatabase {
  private readonly tables: Map<string, Map<string, any>>;

  constructor() {
    this.tables = new Map();
  }

  /**
   * Initialize a table with seed data.
   *
   * @param tableName - Name of the table
   * @param rows - Array of rows to seed
   * @param keyField - Field to use as primary key (default: first UUID field or 'id')
   */
  initializeTable<T extends Record<string, any>>(
    tableName: string,
    rows: T[],
    keyField?: string
  ): void {
    const table = new Map<string, T>();

    // Auto-detect key field if not provided
    const key = keyField || this.detectKeyField(rows[0]);

    rows.forEach((row) => {
      const keyValue = row[key];
      if (!keyValue) {
        throw new Error(`Row is missing key field "${key}"`);
      }
      table.set(keyValue, { ...row });
    });

    this.tables.set(tableName, table);
  }

  /**
   * Insert a row into a table.
   *
   * @param tableName - Name of the table
   * @param row - Row to insert
   * @param keyField - Field to use as primary key
   * @returns The inserted row
   */
  insert<T extends Record<string, any>>(tableName: string, row: T, keyField: string): T {
    const table = this.getOrCreateTable(tableName);
    const keyValue = row[keyField];

    if (!keyValue) {
      throw new Error(`Row is missing key field "${keyField}"`);
    }

    if (table.has(keyValue)) {
      throw new Error(`Row with key "${keyValue}" already exists in table "${tableName}"`);
    }

    const newRow = { ...row };
    table.set(keyValue, newRow);
    return newRow;
  }

  /**
   * Find all rows in a table.
   *
   * @param tableName - Name of the table
   * @returns Array of all rows
   */
  findAll<T extends Record<string, any>>(tableName: string): T[] {
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }
    // Return deep copies to prevent external mutation
    return Array.from(table.values()).map((row) => ({ ...row }));
  }

  /**
   * Find a single row by key.
   *
   * @param tableName - Name of the table
   * @param key - Key value to search for
   * @returns The row or null if not found
   */
  findOne<T extends Record<string, any>>(tableName: string, key: string): T | null {
    const table = this.tables.get(tableName);
    if (!table) {
      return null;
    }
    const row = table.get(key);
    return row ? { ...row } : null;
  }

  /**
   * Find rows matching a filter predicate.
   *
   * @param tableName - Name of the table
   * @param predicate - Filter function
   * @returns Array of matching rows
   */
  findWhere<T extends Record<string, any>>(
    tableName: string,
    predicate: (row: T) => boolean
  ): T[] {
    const all = this.findAll<T>(tableName);
    return all.filter(predicate);
  }

  /**
   * Update a row in a table.
   *
   * @param tableName - Name of the table
   * @param key - Key value to update
   * @param updates - Partial row with fields to update
   * @returns The updated row or null if not found
   */
  update<T extends Record<string, any>>(
    tableName: string,
    key: string,
    updates: Partial<T>
  ): T | null {
    const table = this.tables.get(tableName);
    if (!table) {
      return null;
    }

    const existing = table.get(key);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates };
    table.set(key, updated);
    return { ...updated };
  }

  /**
   * Delete a row from a table.
   *
   * @param tableName - Name of the table
   * @param key - Key value to delete
   * @returns True if deleted, false if not found
   */
  delete(tableName: string, key: string): boolean {
    const table = this.tables.get(tableName);
    if (!table) {
      return false;
    }
    return table.delete(key);
  }

  /**
   * Clear all data from a table.
   *
   * @param tableName - Name of the table
   */
  clearTable(tableName: string): void {
    this.tables.delete(tableName);
  }

  /**
   * Clear all tables and data.
   */
  clearAll(): void {
    this.tables.clear();
  }

  /**
   * Get or create a table.
   */
  private getOrCreateTable(tableName: string): Map<string, any> {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
    return this.tables.get(tableName)!;
  }

  /**
   * Auto-detect key field from row.
   * Looks for common patterns:
   * - Fields ending with '_id' (e.g., 'service_portfolio_id')
   * - Field named 'id'
   * - First UUID-formatted field
   */
  private detectKeyField(row: Record<string, any>): string {
    if (!row) {
      return 'id';
    }

    const keys = Object.keys(row);

    // Look for fields ending with '_id'
    const idField = keys.find((key) => key.endsWith('_id'));
    if (idField) {
      return idField;
    }

    // Look for 'id' field
    if (keys.includes('id')) {
      return 'id';
    }

    // Look for first UUID field
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuidField = keys.find((key) => {
      const value = row[key];
      return typeof value === 'string' && uuidRegex.test(value);
    });
    if (uuidField) {
      return uuidField;
    }

    // Default to 'id'
    return 'id';
  }
}
