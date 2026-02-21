/**
 * SelectorBuilder usage example (v3.1.0)
 *
 * The SelectorBuilder provides:
 * 1. API compliance — wraps raw expressions in Filter() as required by AppSheet API
 * 2. Injection safety — escapes user input to prevent filter injection attacks
 * 3. DI extensibility — injectable via AppSheetClientFactory for custom/AOP behavior
 *
 * Note: When using AppSheetClient or DynamicTable, selector wrapping happens
 * automatically in find()/findOne(). You only need SelectorBuilder directly
 * when building selectors from untrusted user input.
 */

import { SelectorBuilder, SelectorBuilderInterface, AppSheetClientFactory } from '../src';

// --- 1. Direct Usage: Value Escaping ---

function directUsageExample() {
  const builder = new SelectorBuilder();

  // Escape user input for safe use in expressions
  const userInput = 'O"Brien';
  const escaped = builder.escapeValue(userInput);
  console.log(escaped); // => 'O\"Brien'

  // Use escaped value in a manually built expression
  const expr = `[LastName] = "${escaped}" AND [Status] = "Active"`;
  console.log(expr);
  // => '[LastName] = "O\"Brien" AND [Status] = "Active"'
}

// --- 2. Direct Usage: Build Safe Filters ---

function buildFilterExample() {
  const builder = new SelectorBuilder();

  // Build a complete, injection-safe Filter() expression
  const filter = builder.buildFilter('extract_user', '[user_id]', 'abc-123');
  console.log(filter);
  // => 'Filter(extract_user, [user_id] = "abc-123")'

  // Injection attempt is safely escaped
  const malicious = '123" OR "1"="1';
  const safeFilter = builder.buildFilter('extract_user', '[user_id]', malicious);
  console.log(safeFilter);
  // => 'Filter(extract_user, [user_id] = "123\" OR \"1\"=\"1")'

  // Validate identifiers before using them
  console.log(builder.isSafeIdentifier('user_id')); // true
  console.log(builder.isSafeIdentifier('user-id')); // false (hyphen)
  console.log(builder.isSafeIdentifier('user id')); // false (space)
}

// --- 3. Automatic Wrapping (happens inside AppSheetClient.find()) ---

function automaticWrappingExample() {
  const builder = new SelectorBuilder();

  // Raw expression gets wrapped in Filter()
  const wrapped = builder.ensureFunction('[Status] = "Active"', 'People');
  console.log(wrapped);
  // => 'Filter(People, [Status] = "Active")'

  // Already-wrapped expressions pass through unchanged (idempotent)
  const existing = builder.ensureFunction('Filter(People, [Status] = "Active")', 'People');
  console.log(existing);
  // => 'Filter(People, [Status] = "Active")'

  // Other AppSheet functions are also recognized
  const orderBy = builder.ensureFunction('OrderBy(Filter(People, true), [Name], true)', 'People');
  console.log(orderBy);
  // => 'OrderBy(Filter(People, true), [Name], true)'

  // Select() and Top() are recognized too
  const select = builder.ensureFunction(
    'Select(People[Name], [Status] = "Active", true)',
    'People'
  );
  console.log(select);
  // => 'Select(People[Name], [Status] = "Active", true)'
}

// --- 4. DI Injection: Custom SelectorBuilder via Factory ---

function diInjectionExample() {
  // Create a custom SelectorBuilder (e.g. with logging)
  class LoggedSelectorBuilder extends SelectorBuilder {
    ensureFunction(selector: string, tableName: string): string {
      const result = super.ensureFunction(selector, tableName);
      console.log(`[SelectorBuilder] ${selector} => ${result}`);
      return result;
    }

    buildFilter(tableName: string, fieldName: string, value: string): string {
      const result = super.buildFilter(tableName, fieldName, value);
      console.log(`[SelectorBuilder] buildFilter => ${result}`);
      return result;
    }
  }

  // Inject custom builder into factory
  const factory = new AppSheetClientFactory(new LoggedSelectorBuilder());

  // All clients created by this factory will use the LoggedSelectorBuilder
  // const client = factory.create(connectionDef, 'user@example.com');
  // client.find({ tableName: 'Users', selector: '[Status] = "Active"' });
  // => Console: [SelectorBuilder] [Status] = "Active" => Filter(Users, [Status] = "Active")

  console.log('Factory created with custom SelectorBuilder');
}

// --- 5. AOP-Compatible Subclass (for projects using @LogExecution etc.) ---

function aopExample() {
  // In projects using TypeScript decorators for AOP logging (e.g. service_portfolio_mcp):
  //
  // class AopSelectorBuilder extends SelectorBuilder {
  //   @LogExecution({ level: 'debug' })
  //   ensureFunction(selector: string, tableName: string): string {
  //     return super.ensureFunction(selector, tableName);
  //   }
  //
  //   @LogExecution({ level: 'debug' })
  //   buildFilter(tableName: string, fieldName: string, value: string): string {
  //     return super.buildFilter(tableName, fieldName, value);
  //   }
  // }
  //
  // // Register in tsyringe DI container:
  // container.register(TOKENS.AppSheetClientFactory, {
  //   useFactory: () => new AppSheetClientFactory(new AopSelectorBuilder()),
  // });

  console.log('AOP example (see comments in source)');
}

// --- Run examples ---

console.log('=== 1. Direct Usage: Value Escaping ===');
directUsageExample();

console.log('\n=== 2. Direct Usage: Build Safe Filters ===');
buildFilterExample();

console.log('\n=== 3. Automatic Wrapping ===');
automaticWrappingExample();

console.log('\n=== 4. DI Injection ===');
diInjectionExample();

console.log('\n=== 5. AOP-Compatible Subclass ===');
aopExample();
