# AppSheet Field Type Support and Validation Enhancement

## Overview
Extend the AppSheet library to support all AppSheet-specific field types in schema definitions and implement comprehensive validation for required fields and type-specific constraints during add/update operations.

## Problem Statement
Currently, the library uses generic TypeScript types (`string`, `number`, `boolean`, `date`, `array`, `object`) which don't map directly to AppSheet's rich type system. This leads to:

1. **Missing Type Information**: No way to specify AppSheet-specific types like `Enum`, `EnumList`, `Email`, `Phone`, `DateTime`, `Price`, etc.
2. **Incomplete Enum Support**: Schema supports `enum` arrays but doesn't distinguish between `Enum` (single value) and `EnumList` (multiple values)
3. **Limited Validation**: No validation for AppSheet-specific constraints (e.g., email format, phone format, price format)
4. **Inconsistent Required Field Handling**: Required field validation only happens during `add()`, not consistently enforced

## Current State

### Current Schema Type System
```typescript
// src/types/schema.ts
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  enum?: string[];        // Old enum property
  description?: string;
}

// Fields could be defined as:
// - Simple string: "email": "string"
// - Full object: "email": { type: "string", required: true }
```

### Current Validation (DynamicTable.ts)
- Type validation for basic types (string, number, boolean, date, array, object)
- Required field validation only on `add()` operations
- Generic enum validation (array membership check)
- No AppSheet-specific type validation

## Requirements

### 1. AppSheet Field Type System

Add support for all AppSheet column types:

#### Core Types
- `Text` - Base text type
- `Number` - Numeric values
- `Date` - Date only (YYYY-MM-DD)
- `DateTime` - Date and time
- `Time` - Time only
- `Duration` - Time intervals
- `YesNo` - Boolean values

#### Specialized Text Types
- `Name` - Person names
- `Email` - Email addresses (with format validation)
- `URL` - Web URLs (with format validation)
- `Phone` - Phone numbers (with format validation)
- `Address` - Physical addresses

#### Specialized Number Types
- `Decimal` - Decimal numbers
- `Percent` - Percentage values (0.00 to 1.00)
- `Price` - Currency values

#### Selection Types
- `Enum` - Single selection from fixed list
- `EnumList` - Multiple selections from fixed list

#### Media Types
- `Image` - Image files
- `File` - File attachments
- `Drawing` - Drawing data
- `Signature` - Signature data

#### Tracking Types
- `ChangeCounter` - Edit counter
- `ChangeTimestamp` - Last edit timestamp
- `ChangeLocation` - Edit location

#### Reference Types
- `Ref` - Reference to another table
- `RefList` - Multiple references

#### Special Types
- `Color` - Color values
- `Show` - Display-only columns

### 2. Enhanced Field Definition

```typescript
export type AppSheetFieldType =
  // Core types
  | 'Text' | 'Number' | 'Date' | 'DateTime' | 'Time' | 'Duration' | 'YesNo'
  // Specialized text
  | 'Name' | 'Email' | 'URL' | 'Phone' | 'Address'
  // Specialized numbers
  | 'Decimal' | 'Percent' | 'Price'
  // Selection types
  | 'Enum' | 'EnumList'
  // Media types
  | 'Image' | 'File' | 'Drawing' | 'Signature'
  // Tracking types
  | 'ChangeCounter' | 'ChangeTimestamp' | 'ChangeLocation'
  // Reference types
  | 'Ref' | 'RefList'
  // Special types
  | 'Color' | 'Show';

export interface FieldDefinition {
  /** AppSheet field type (required) */
  type: AppSheetFieldType;

  /** Whether the field is required (default: false) */
  required?: boolean;

  /** Allowed values for Enum/EnumList fields */
  allowedValues?: string[];

  /** Referenced table name for Ref/RefList fields */
  referencedTable?: string;

  /** Field description */
  description?: string;

  /** Additional AppSheet-specific configuration */
  appSheetConfig?: {
    /** Allow other values (for Enum) */
    allowOtherValues?: boolean;

    /** Format hint for display */
    format?: string;

    /** Default value */
    defaultValue?: any;
  };
}

export interface TableDefinition {
  /** Actual AppSheet table name */
  tableName: string;

  /** Name of the key/primary field */
  keyField: string;

  /** Field definitions (name -> definition object only) */
  fields: Record<string, FieldDefinition>;
}
```

### 3. Enhanced Validation

#### Required Field Validation
- Validate required fields during both `add()` and `update()` operations
- During `update()`: Only validate if field is present in the update payload
- Clear error messages indicating which field is missing and in which row

#### Type-Specific Validation
- **Email**: Validate email format (basic RFC 5322 check)
- **URL**: Validate URL format (http/https)
- **Phone**: Validate phone format (flexible international format)
- **Enum**: Validate single value against `allowedValues`
- **EnumList**: Validate array of values against `allowedValues`
- **Percent**: Validate range (0.00 to 1.00)
- **Price**: Validate numeric format with optional decimals
- **Date**: Validate ISO date format (YYYY-MM-DD)
- **DateTime**: Validate ISO datetime format
- **YesNo**: Validate boolean or "Yes"/"No" string

#### Validation Behavior
```typescript
// Current behavior (keep):
- add(): Validate required fields + type validation
- update(): Skip required validation, only type validation for provided fields

// Enhanced behavior (add):
- add(): Required validation + AppSheet type validation + format validation
- update(): Type validation + format validation for provided fields only
```

### 4. SchemaInspector Enhancement

Update CLI inspection to detect AppSheet field types:
- Analyze actual data to infer AppSheet types (not just JS types)
- Detect email patterns → `Email` type
- Detect URL patterns → `URL` type
- Detect phone patterns → `Phone` type
- Detect percentage values → `Percent` type
- Detect enum lists (comma-separated values) → `EnumList` type
- Extract `allowedValues` from actual data for Enum/EnumList fields

### 5. Error Messages

Provide clear, actionable error messages:
```typescript
// Examples:
"Row 0: Field 'email' is required in table 'users'"
"Row 1: Field 'email' must be a valid email address, got: 'invalid-email'"
"Row 2: Field 'status' must be one of: Active, Inactive, Pending. Got: 'Unknown'"
"Row 3: Field 'tags' must be an array of values from: tag1, tag2, tag3. Got: ['invalid-tag']"
"Row 4: Field 'discount' must be a percentage between 0.00 and 1.00, got: 1.5"
```

## Implementation Plan

### Phase 1: Type System Extension
1. Add `AppSheetFieldType` enum to `src/types/schema.ts`
2. Create `EnhancedFieldDefinition` interface
3. Update `TableDefinition` to use new field definition format
4. Remove old `FieldType` and replace with `AppSheetFieldType`

### Phase 2: Validation Enhancement
1. Extract validation logic to separate validator classes:
   - `BaseTypeValidator` - Basic type checks
   - `AppSheetTypeValidator` - AppSheet-specific validation
   - `FormatValidator` - Format validation (email, URL, phone)
2. Update `DynamicTable.validateRows()` to use new validators
3. Add format validation for specialized types
4. Enhance error messages with detailed context

### Phase 3: SchemaInspector Enhancement
1. Add pattern detection for specialized types
2. Implement `allowedValues` extraction for Enum/EnumList
3. Add heuristics for type inference (e.g., email pattern detection)
4. Update CLI output to show AppSheet types

### Phase 4: Documentation
1. Update CLAUDE.md with new type system
2. Document all AppSheet types with examples
3. Add validation examples to README
4. Update migration guide for v2.0.0 (breaking changes)

### Phase 5: Testing
1. Unit tests for all AppSheet type validations
2. Integration tests with real AppSheet data patterns
3. CLI inspection tests with various data patterns
4. Test error messages for all validation scenarios

## Success Criteria

1. ✅ All AppSheet field types are supported in schema definitions
2. ✅ Type-specific validation works for all specialized types
3. ✅ Enum and EnumList are properly distinguished and validated
4. ✅ Required field validation works consistently
5. ✅ Clear error messages for all validation failures
6. ✅ CLI can detect and generate AppSheet-specific types
7. ✅ Comprehensive test coverage (>90%)
8. ✅ Documentation updated and complete
9. ✅ Migration guide for v2.0.0 breaking changes

## Technical Notes

### Schema Format (v2.0.0)
```typescript
// Schema format (only supported format)
{
  "fields": {
    "email": {
      "type": "Email",
      "required": true
    },
    "age": {
      "type": "Number",
      "required": false
    },
    "status": {
      "type": "Enum",
      "allowedValues": ["Active", "Inactive", "Pending"],
      "required": true
    },
    "tags": {
      "type": "EnumList",
      "allowedValues": ["TypeScript", "JavaScript", "Node.js"],
      "required": false
    }
  }
}
```

**Breaking Changes**:
- Old generic types (`'string'`, `'number'`, `'boolean'`, `'date'`, `'array'`, `'object'`) are no longer supported
- Shorthand string format (e.g., `"email": "string"`) is no longer supported
- All fields must use the full object definition with `type` property
- `enum` property renamed to `allowedValues` for clarity

### Validation Order
1. Check if field exists (for required validation)
2. Check basic type (string, number, etc.)
3. Check AppSheet type constraints
4. Check format (for Email, URL, Phone)
5. Check enum/enumList values

### Performance Considerations
- Keep validation fast (< 1ms per field)
- Cache compiled regex patterns for format validation
- Lazy validation: Only validate provided fields
- No validation for undefined/null values (unless required)

## Files to Modify

1. `src/types/schema.ts` - Add AppSheet types
2. `src/client/DynamicTable.ts` - Enhance validation
3. `src/utils/validators/` - New validator classes (to be created)
4. `src/cli/SchemaInspector.ts` - Add type detection
5. `tests/client/DynamicTable.test.ts` - Add validation tests
6. `tests/utils/validators/` - New validator tests
7. `CLAUDE.md` - Update documentation
8. `README.md` - Add examples

## Dependencies

No new external dependencies required. Use built-in Node.js capabilities for:
- Email validation: RFC 5322 regex
- URL validation: Built-in URL class
- Phone validation: Flexible international format regex

## Estimated Effort

- Type System Extension: 4 hours
- Validation Enhancement: 8 hours
- SchemaInspector Enhancement: 6 hours
- Documentation: 4 hours
- Testing: 8 hours
- **Total: ~30 hours (4-5 days)**

## Related Issues

- Schema validation improvements
- CLI inspection enhancements
- API response handling

## References

- [AppSheet Column Data Types](https://support.google.com/appsheet/answer/10106435)
- [AppSheet Enum Documentation](https://support.google.com/appsheet/answer/10107878)
- Current implementation: `src/client/DynamicTable.ts:285-411`
