# Migration Guide: v1.x → v2.0.0

This guide helps you upgrade from version 1.x to 2.0.0 of the AppSheet library.

## Overview

Version 2.0.0 introduces **breaking changes** to provide better type safety and validation through AppSheet-specific field types. The old generic TypeScript types (`string`, `number`, etc.) have been replaced with 27 AppSheet field types that match the actual AppSheet column types.

## What's Changed

### 1. Field Type System

**Old (v1.x)**: Generic TypeScript types
```typescript
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
```

**New (v2.0.0)**: AppSheet-specific types
```typescript
type AppSheetFieldType =
  | 'Text' | 'Email' | 'URL' | 'Phone'
  | 'Number' | 'Decimal' | 'Percent' | 'Price'
  | 'Date' | 'DateTime' | 'Time' | 'Duration'
  | 'YesNo' | 'Enum' | 'EnumList'
  // ... and 12 more types
```

### 2. Schema Format

**Old (v1.x)**: Mixed formats allowed
```yaml
fields:
  email: string              # Shorthand string
  age: number                # Shorthand string
  status:                    # Full object
    type: string
    enum: ["Active", "Inactive"]
```

**New (v2.0.0)**: Only full object format
```yaml
fields:
  email:
    type: Email
    required: true
  age:
    type: Number
    required: false
  status:
    type: Enum
    required: true
    allowedValues: ["Active", "Inactive"]
```

### 3. Property Renames

| Old Property | New Property | Notes |
|--------------|--------------|-------|
| `enum` | `allowedValues` | More descriptive name |

## Migration Steps

### Step 1: Update Schema Files

#### Generic Types → AppSheet Types

```yaml
# Before (v1.x)
fields:
  name: string
  email: string
  age: number
  active: boolean
  createdAt: date
  tags: array

# After (v2.0.0)
fields:
  name:
    type: Text
    required: false
  email:
    type: Email
    required: true
  age:
    type: Number
    required: false
  active:
    type: YesNo
    required: false
  createdAt:
    type: DateTime
    required: false
  tags:
    type: EnumList
    required: false
```

#### Type Mapping Reference

| Old Type | New Type(s) | Notes |
|----------|-------------|-------|
| `string` | `Text`, `Email`, `URL`, `Phone`, `Address`, `Name` | Choose based on data |
| `number` | `Number`, `Decimal`, `Price`, `Percent` | Choose based on usage |
| `boolean` | `YesNo` | Accepts boolean or "Yes"/"No" strings |
| `date` | `Date`, `DateTime`, `Time`, `Duration` | Choose based on precision |
| `array` | `EnumList`, `RefList` | Choose based on usage |
| `object` | (various) | Depends on context |

### Step 2: Update Enum Definitions

```yaml
# Before (v1.x)
status:
  type: string
  enum: ["Active", "Inactive", "Pending"]

# After (v2.0.0)
status:
  type: Enum
  required: true
  allowedValues: ["Active", "Inactive", "Pending"]
```

### Step 3: Use CLI to Generate New Schema

The easiest way to migrate is to use the CLI inspect command:

```bash
# Generate new schema from existing AppSheet app
npx appsheet inspect \
  --app-id YOUR_APP_ID \
  --key YOUR_ACCESS_KEY \
  --output schema.yaml

# The CLI will auto-detect field types including:
# - Email addresses
# - URLs
# - Phone numbers
# - Enum fields (with extracted allowedValues)
# - EnumList fields
# - Dates, DateTimes, Percentages, etc.
```

### Step 4: Review Auto-Generated Schema

The CLI uses smart heuristics but may need manual adjustments:

```yaml
# CLI might detect this as Text
website:
  type: Text

# But you should change it to URL for validation
website:
  type: URL
  required: false
```

### Step 5: Test Your Schema

```bash
# Validate schema structure
npx appsheet validate --schema schema.yaml

# Run your application tests
npm test
```

## Common Migration Patterns

### Pattern 1: Simple String Fields

```yaml
# Before
name: string

# After - Choose appropriate type
name:
  type: Text        # Generic text
# or
email:
  type: Email       # Email with validation
# or
website:
  type: URL         # URL with validation
```

### Pattern 2: Enum Fields

```yaml
# Before
priority:
  type: string
  enum: ["Low", "Medium", "High"]

# After
priority:
  type: Enum
  required: true
  allowedValues: ["Low", "Medium", "High"]
```

### Pattern 3: Multi-Select Fields

```yaml
# Before
skills:
  type: array

# After
skills:
  type: EnumList
  required: false
  allowedValues: ["JavaScript", "TypeScript", "Python"]
```

### Pattern 4: Numeric Fields

```yaml
# Before
quantity: number
price: number
discount: number

# After - Choose appropriate numeric type
quantity:
  type: Number      # Integer or decimal
  required: true
price:
  type: Price       # Currency value
  required: true
discount:
  type: Percent     # 0.00 to 1.00
  required: false
```

## Validation Changes

Version 2.0.0 adds comprehensive validation:

### Email Validation
```typescript
// Now validates email format
await table.add([{ email: 'invalid' }]);
// ❌ Error: must be a valid email address
```

### URL Validation
```typescript
// Now validates URL format
await table.add([{ website: 'not-a-url' }]);
// ❌ Error: must be a valid URL
```

### Enum Validation
```typescript
// Now validates against allowedValues
await table.add([{ status: 'Unknown' }]);
// ❌ Error: must be one of: Active, Inactive, Pending
```

### Percent Range Validation
```typescript
// Now validates range (0.00 to 1.00)
await table.add([{ discount: 1.5 }]);
// ❌ Error: must be between 0.00 and 1.00
```

## Automated Migration Tool

For large schemas, consider this migration script:

```typescript
import * as fs from 'fs';
import * as yaml from 'yaml';

const oldSchema = yaml.parse(fs.readFileSync('old-schema.yaml', 'utf-8'));

// Type mapping
const typeMap = {
  'string': 'Text',
  'number': 'Number',
  'boolean': 'YesNo',
  'date': 'Date',
  'array': 'EnumList',
  'object': 'Text',
};

function migrateField(oldField: any) {
  if (typeof oldField === 'string') {
    // Shorthand format
    return {
      type: typeMap[oldField] || 'Text',
      required: false,
    };
  }

  // Full object format
  const newField: any = {
    type: typeMap[oldField.type] || 'Text',
    required: oldField.required || false,
  };

  // Rename enum → allowedValues
  if (oldField.enum) {
    newField.type = 'Enum';
    newField.allowedValues = oldField.enum;
  }

  if (oldField.description) {
    newField.description = oldField.description;
  }

  return newField;
}

// Migrate all tables
for (const [connName, conn] of Object.entries(oldSchema.connections)) {
  for (const [tableName, table] of Object.entries((conn as any).tables)) {
    const newFields: any = {};
    for (const [fieldName, fieldDef] of Object.entries((table as any).fields)) {
      newFields[fieldName] = migrateField(fieldDef);
    }
    (table as any).fields = newFields;
  }
}

fs.writeFileSync('migrated-schema.yaml', yaml.stringify(oldSchema));
console.log('✓ Schema migrated to v2.0.0 format');
console.log('⚠ Please review and adjust field types manually');
```

## Troubleshooting

### Error: "Type 'string' is not assignable to type 'AppSheetFieldType'"

**Cause**: Using old generic type in schema

**Solution**: Replace with AppSheet type:
```yaml
# ❌ Old
email: string

# ✅ New
email:
  type: Email
```

### Error: "Field 'enum' does not exist on type 'FieldDefinition'"

**Cause**: Using old `enum` property

**Solution**: Rename to `allowedValues`:
```yaml
# ❌ Old
status:
  type: string
  enum: ["Active"]

# ✅ New
status:
  type: Enum
  allowedValues: ["Active"]
```

### Error: "Shorthand format no longer supported"

**Cause**: Using shorthand string format

**Solution**: Use full object format:
```yaml
# ❌ Old
name: string

# ✅ New
name:
  type: Text
  required: false
```

## Getting Help

- **Documentation**: See CLAUDE.md for complete type reference
- **CLI Help**: Run `npx appsheet inspect --help`
- **Examples**: Check `examples/` directory for v2.0.0 schemas
- **Issues**: Report problems at https://github.com/techdivision/appsheet/issues

## Summary

1. ✅ Replace generic types with AppSheet types
2. ✅ Convert all fields to full object format
3. ✅ Rename `enum` → `allowedValues`
4. ✅ Use CLI to auto-generate new schema
5. ✅ Review and test thoroughly

**Estimated Migration Time**: 15-30 minutes per schema file (depending on size)
