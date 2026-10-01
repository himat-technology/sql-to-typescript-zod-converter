import { describe, expect, it } from 'vitest';
import { parseSql } from '../parser/sqlParser';
import type { SqlDialect } from '../parser/types';
import { PRESETS } from '../presets';
import { toCamelCase, toPascalCase, toSnakeCase } from './casingUtils';
import { generateCode } from './codeGenerator';
import { singularize, toSchemaName, toTypeName } from './identifierUtils';
import { buildGenerationModel } from './model';
import { DEFAULT_GENERATOR_OPTIONS, type GeneratorOptions } from './options';

const opts = (overrides: Partial<GeneratorOptions> = {}): GeneratorOptions => ({ ...DEFAULT_GENERATOR_OPTIONS, ...overrides });

function generate(sql: string, overrides: Partial<GeneratorOptions> = {}, dialect: SqlDialect = 'postgresql') {
  const parsed = parseSql(sql, dialect);
  return generateCode(parsed.schema, dialect, opts(overrides));
}

function fieldOf(sql: string, column: string, overrides: Partial<GeneratorOptions> = {}, dialect: SqlDialect = 'postgresql') {
  const parsed = parseSql(sql, dialect);
  const model = buildGenerationModel(parsed.schema, dialect, opts(overrides));
  const field = model.tables[0].fields.find((f) => f.column.name === column);
  if (!field) throw new Error(`no field ${column}`);
  return field;
}

const TYPES_SQL = `CREATE TABLE things (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  body TEXT,
  qty INTEGER NOT NULL,
  big BIGINT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  ratio DOUBLE PRECISION,
  active BOOLEAN NOT NULL,
  meta JSONB NOT NULL,
  born DATE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  weird XYZTYPE
);`;

describe('casing', () => {
  it('converts to camelCase', () => {
    expect(toCamelCase('full_name')).toBe('fullName');
    expect(toCamelCase('FullName')).toBe('fullName');
    expect(toCamelCase('user-ID')).toBe('userId');
    expect(toCamelCase('author email')).toBe('authorEmail');
    expect(toCamelCase('ID')).toBe('id');
  });

  it('converts to snake_case', () => {
    expect(toSnakeCase('full_name')).toBe('full_name');
    expect(toSnakeCase('fullName')).toBe('full_name');
    expect(toSnakeCase('CreatedAt')).toBe('created_at');
    expect(toSnakeCase('HTTPStatusCode')).toBe('http_status_code');
  });

  it('converts to PascalCase', () => {
    expect(toPascalCase('full_name')).toBe('FullName');
    expect(toPascalCase('is_active')).toBe('IsActive');
    expect(toPascalCase('TenantId')).toBe('TenantId');
  });

  it('applies casing to generated fields', () => {
    const sql = 'CREATE TABLE users (full_name TEXT NOT NULL, IsActive BOOLEAN NOT NULL);';
    expect(generate(sql, { fieldCasing: 'camel' }).code).toContain('fullName: z.string()');
    expect(generate(sql, { fieldCasing: 'snake' }).code).toContain('is_active: z.boolean()');
    expect(generate(sql, { fieldCasing: 'pascal' }).code).toContain('FullName: z.string()');
  });
});

describe('identifiers and naming', () => {
  it('singularizes table names', () => {
    expect(singularize('users')).toBe('user');
    expect(singularize('categories')).toBe('category');
    expect(singularize('addresses')).toBe('address');
    expect(singularize('statuses')).toBe('status');
    expect(singularize('people')).toBe('person');
    expect(singularize('metadata')).toBe('metadata');
    expect(singularize('boxes')).toBe('box');
  });

  it('sanitizes unusual SQL names into valid identifiers', () => {
    expect(toTypeName('order-items', true)).toBe('OrderItem');
    expect(toTypeName('task comments', true)).toBe('TaskComment');
    expect(toTypeName('2fa_codes', true)).toBe('Table2faCode');
    expect(toTypeName('dates', true)).toBe('DateRow');
    expect(toTypeName('$$$', true)).toBe('Table');
    expect(toSchemaName('User')).toBe('userSchema');
    expect(toSchemaName('HTTPLog')).toBe('httpLogSchema');
  });

  it('quotes property keys that are not valid identifiers', () => {
    const { code } = generate('CREATE TABLE t ("2nd value" INT NOT NULL, "select" INT NOT NULL);', { fieldCasing: 'snake' });
    expect(code).toContain('"2nd_value": z.number().int()');
    expect(code).toContain('select: z.number().int()');
  });

  it('deduplicates colliding type names', () => {
    const { model } = generate('CREATE TABLE users (id INT); CREATE TABLE user (id INT);');
    expect(model.tables.map((t) => t.typeName)).toEqual(['User', 'User2']);
  });
});

describe('type mapping', () => {
  it('maps VARCHAR to string with max length', () => {
    const f = fieldOf(TYPES_SQL, 'name');
    expect(f.mapped.tsType).toBe('string');
    expect(f.mapped.zod).toBe('z.string().max(100)');
  });

  it('maps INTEGER / BIGINT / DECIMAL to number', () => {
    expect(fieldOf(TYPES_SQL, 'qty').mapped.tsType).toBe('number');
    expect(fieldOf(TYPES_SQL, 'qty').mapped.zod).toBe('z.number().int()');
    expect(fieldOf(TYPES_SQL, 'big').mapped.tsType).toBe('number');
    expect(fieldOf(TYPES_SQL, 'price').mapped.zod).toBe('z.number()');
    expect(fieldOf(TYPES_SQL, 'ratio').mapped.tsType).toBe('number');
  });

  it('maps BOOLEAN to boolean', () => {
    expect(fieldOf(TYPES_SQL, 'active').mapped.tsType).toBe('boolean');
    expect(fieldOf(TYPES_SQL, 'active').mapped.zod).toBe('z.boolean()');
    expect(fieldOf('CREATE TABLE t (flag TINYINT(1) NOT NULL);', 'flag', {}, 'mysql').mapped.tsType).toBe('boolean');
    expect(fieldOf('CREATE TABLE t (flag BIT NOT NULL);', 'flag', {}, 'tsql').mapped.tsType).toBe('boolean');
  });

  it('maps UUID to z.string().uuid()', () => {
    const f = fieldOf(TYPES_SQL, 'id');
    expect(f.mapped.tsType).toBe('string');
    expect(f.mapped.zod).toBe('z.string().uuid()');
    expect(fieldOf("CREATE TABLE t (id CHAR(36) DEFAULT (UUID()));", 'id', {}, 'mysql').mapped.zod).toBe('z.string().uuid()');
  });

  it('maps JSONB to an object or array', () => {
    const f = fieldOf(TYPES_SQL, 'meta');
    expect(f.mapped.tsType).toBe('Record<string, unknown> | unknown[]');
    expect(f.mapped.zod).toBe('z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())])');
  });

  it('keeps every dimension of multi-dimensional arrays', () => {
    const f = fieldOf('CREATE TABLE t (grid int[][] NOT NULL);', 'grid');
    expect(f.mapped.tsType).toBe('number[][]');
    expect(f.mapped.zod).toBe('z.array(z.array(z.number().int()))');
  });

  it('maps SQLite untyped and ANY columns to unknown', () => {
    expect(fieldOf('CREATE TABLE t (x);', 'x', {}, 'sqlite').mapped.zod).toBe('z.unknown()');
    expect(fieldOf('CREATE TABLE t (x ANY);', 'x', {}, 'sqlite').mapped.tsType).toBe('unknown');
  });

  it('maps TIMESTAMP to string by default and Date when enabled', () => {
    expect(fieldOf(TYPES_SQL, 'created_at').mapped.tsType).toBe('string');
    expect(fieldOf(TYPES_SQL, 'created_at').mapped.zod).toBe('z.string().datetime({ local: true })');
    expect(fieldOf(TYPES_SQL, 'updated_at').mapped.zod).toBe('z.string().datetime({ offset: true })');
    expect(fieldOf(TYPES_SQL, 'born').mapped.zod).toBe('z.string().date()');

    const asDate = { timestampsAsDate: true };
    expect(fieldOf(TYPES_SQL, 'created_at', asDate).mapped.tsType).toBe('Date');
    expect(fieldOf(TYPES_SQL, 'created_at', asDate).mapped.zod).toBe('z.coerce.date()');
    expect(fieldOf(TYPES_SQL, 'updated_at', { timestampsAsDate: true, coerceDates: false }).mapped.zod).toBe('z.date()');
    expect(fieldOf(TYPES_SQL, 'born', asDate).mapped.tsType).toBe('Date');
  });

  it('maps enums to string unions', () => {
    const f = fieldOf("CREATE TABLE t (role ENUM('a','b') NOT NULL);", 'role', {}, 'mysql');
    expect(f.mapped.tsType).toBe('"a" | "b"');
    expect(f.mapped.zod).toBe('z.enum(["a", "b"])');
  });

  it('maps arrays', () => {
    const f = fieldOf('CREATE TABLE t (tags TEXT[] NOT NULL);', 'tags');
    expect(f.mapped.tsType).toBe('string[]');
    expect(f.mapped.zod).toBe('z.array(z.string())');
  });

  it('falls back to string for unknown types with a warning', () => {
    const { model } = generate(TYPES_SQL);
    expect(model.tables[0].fields.find((f) => f.key === 'weird')!.mapped.tsType).toBe('string');
    expect(model.warnings.some((w) => w.message.startsWith('Unsupported SQL type: XYZTYPE'))).toBe(true);
  });
});

describe('nullability and optionality', () => {
  const sql = 'CREATE TABLE t (email TEXT NOT NULL, description TEXT, score INT NOT NULL DEFAULT 0);';

  it('keeps NOT NULL fields required', () => {
    const { code } = generate(sql, { outputMode: 'ts' });
    expect(code).toContain('  email: string;');
  });

  it('renders nullable fields as nullable + optional by default', () => {
    expect(generate(sql, { outputMode: 'ts' }).code).toContain('  description?: string | null;');
    expect(generate(sql, { outputMode: 'zod' }).code).toContain('description: z.string().nullable().optional(),');
  });

  it('supports nullable-only and optional-only styles', () => {
    expect(generate(sql, { outputMode: 'ts', nullableStyle: 'nullable' }).code).toContain('  description: string | null;');
    expect(generate(sql, { outputMode: 'zod', nullableStyle: 'nullable' }).code).toContain('description: z.string().nullable(),');
    expect(generate(sql, { outputMode: 'ts', nullableStyle: 'optional' }).code).toContain('  description?: string;');
    expect(generate(sql, { outputMode: 'zod', nullableStyle: 'optional' }).code).toContain('description: z.string().optional(),');
  });

  it('can make defaulted columns optional', () => {
    expect(generate(sql, { outputMode: 'zod' }).code).toContain('score: z.number().int(),');
    expect(generate(sql, { outputMode: 'zod', defaultsOptional: true }).code).toContain('score: z.number().int().optional(),');
  });
});

describe('code generation', () => {
  const sql = 'CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);';

  it('generates TypeScript interfaces', () => {
    const { code } = generate(sql, { outputMode: 'ts', tsSyntax: 'interface', includeComments: false });
    expect(code).toContain('export interface User {\n  id: string;\n  email: string;\n}');
    expect(code).not.toContain('import { z }');
  });

  it('generates TypeScript type aliases', () => {
    const { code } = generate(sql, { outputMode: 'ts', tsSyntax: 'type', includeComments: false });
    expect(code).toContain('export type User = {\n  id: string;\n  email: string;\n};');
  });

  it('generates Zod-only schemas', () => {
    const { code } = generate(sql, { outputMode: 'zod', includeComments: false });
    expect(code).toContain('import { z } from "zod";');
    expect(code).toContain('export const userSchema = z.object({\n  id: z.string().uuid(),\n  email: z.string(),\n});');
    expect(code).not.toContain('z.infer');
  });

  it('generates combined TypeScript + Zod output', () => {
    const typeAlias = generate(sql, { outputMode: 'ts-zod', tsSyntax: 'type', includeComments: false }).code;
    expect(typeAlias).toContain('export const userSchema = z.object({');
    expect(typeAlias).toContain('export type User = z.infer<typeof userSchema>;');
    const iface = generate(sql, { outputMode: 'ts-zod', tsSyntax: 'interface', includeComments: false }).code;
    expect(iface).toContain('export interface User extends z.infer<typeof userSchema> {}');
  });

  it('emits shared enum schemas for PostgreSQL enum types', () => {
    const { code } = generate(
      "CREATE TYPE order_status AS ENUM ('pending', 'paid'); CREATE TABLE orders (id SERIAL PRIMARY KEY, status order_status NOT NULL);",
      { outputMode: 'ts-zod', tsSyntax: 'type' },
    );
    expect(code).toContain('export const orderStatusSchema = z.enum(["pending", "paid"]);');
    expect(code).toContain('export type OrderStatus = z.infer<typeof orderStatusSchema>;');
    expect(code).toContain('status: orderStatusSchema,');
  });

  it('includes JSDoc metadata', () => {
    const { code } = generate("CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE -- login */ email\n);");
    expect(code).toContain('/** UUID · primary key · default: gen_random_uuid() */');
    expect(code).toContain('login *\\/ email');
  });

  it('generates a schema for every table in every preset', () => {
    for (const preset of PRESETS) {
      const { code, model } = generate(preset.sql, {}, preset.dialect);
      const tableCount = parseSql(preset.sql, preset.dialect).schema.tables.length;
      expect(model.tables).toHaveLength(tableCount);
      expect(code.match(/export const \w+Schema = z\.object/g)).toHaveLength(tableCount);
    }
  });

  it('returns empty output for an empty schema', () => {
    expect(generate('').code).toBe('');
  });
});
