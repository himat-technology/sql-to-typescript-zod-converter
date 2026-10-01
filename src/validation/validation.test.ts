import { describe, expect, it } from 'vitest';
import { buildGenerationModel } from '../generators/model';
import { DEFAULT_GENERATOR_OPTIONS, type GeneratorOptions } from '../generators/options';
import { parseSql } from '../parser/sqlParser';
import type { SqlDialect } from '../parser/types';
import { PRESETS } from '../presets';
import { createInvalidSampleRow, createSampleRow } from './sampleRowFactory';
import { validateSample } from './sampleValidator';
import { buildRuntimeSchemas } from './schemaBuilder';

function runtime(sql: string, overrides: Partial<GeneratorOptions> = {}, dialect: SqlDialect = 'postgresql') {
  const model = buildGenerationModel(parseSql(sql, dialect).schema, dialect, { ...DEFAULT_GENERATOR_OPTIONS, ...overrides });
  return { model, runtime: buildRuntimeSchemas(model) };
}

const USERS_SQL = `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  is_active BOOLEAN NOT NULL,
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ
);`;

describe('runtime schema builder', () => {
  it('executes the generated Zod code', () => {
    const { runtime: rt } = runtime(USERS_SQL);
    expect(rt.error).toBeUndefined();
    expect(rt.tables).toHaveLength(1);
    expect(rt.tables[0].schemaName).toBe('userSchema');
    expect(rt.source).toContain('const userSchema = z.object({');
    expect(rt.source).toContain('role: z.enum(["admin", "member"]),');
  });

  it('accepts JSON objects and arrays, and nested array columns', () => {
    const { model, runtime: rt } = runtime('CREATE TABLE t (meta JSONB NOT NULL, grid INT[][] NOT NULL);');
    const schema = rt.tables[0].schema;
    expect(validateSample(schema, '{"meta": ["a", 1], "grid": [[1, 2], [3, 4]]}').status).toBe('valid');
    expect(validateSample(schema, '{"meta": {"k": 1}, "grid": [[1]]}').status).toBe('valid');
    expect(validateSample(schema, '{"meta": "text", "grid": [1, 2]}').status).toBe('invalid');
    expect(schema.safeParse(createSampleRow(model.tables[0])).success).toBe(true);
  });
});

describe('sample row validation', () => {
  const { runtime: rt } = runtime(USERS_SQL);
  const schema = rt.tables[0].schema;

  it('accepts a valid row', () => {
    const outcome = validateSample(
      schema,
      JSON.stringify({
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'alex@himat.tech',
        fullName: 'Alex Dev',
        role: 'admin',
        isActive: true,
      }),
    );
    expect(outcome.status).toBe('valid');
  });

  it('accepts an array of valid rows', () => {
    const row = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', email: 'a@b.c', fullName: 'A', role: 'member', isActive: false, price: null };
    const outcome = validateSample(schema, JSON.stringify([row, row]));
    expect(outcome).toMatchObject({ status: 'valid', rowCount: 2 });
  });

  it('groups missing fields, invalid types, UUIDs and enum values', () => {
    const outcome = validateSample(
      schema,
      JSON.stringify({ id: 'nope', email: 'alex@himat.tech', role: 'owner', price: '12.50' }),
    );
    expect(outcome.status).toBe('invalid');
    if (outcome.status !== 'invalid') return;
    const byId = Object.fromEntries(outcome.groups.map((g) => [g.id, g]));
    expect(byId.missing.title).toBe('Missing Required Fields');
    expect(byId.missing.items.map((i) => i.path).sort()).toEqual(['fullName', 'isActive']);
    expect(byId.type.items[0].message).toBe('price expected number, received string');
    expect(byId.uuid.title).toBe('Invalid UUID');
    expect(byId.uuid.items[0].path).toBe('id');
    expect(byId.enum.items[0].path).toBe('role');
  });

  it('reports invalid JSON with a position', () => {
    const outcome = validateSample(schema, '{\n  "id": "x",\n  oops\n}');
    expect(outcome.status).toBe('invalid-json');
    if (outcome.status === 'invalid-json') expect(outcome.line).toBe(3);
  });

  it('rejects unknown keys in strict mode only', () => {
    const row = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', email: 'a@b.c', fullName: 'A', role: 'admin', isActive: true, extra: 1 };
    expect(validateSample(schema, JSON.stringify(row)).status).toBe('valid');
    const strict = validateSample(schema, JSON.stringify(row), { strict: true });
    expect(strict.status).toBe('invalid');
    if (strict.status === 'invalid') expect(strict.groups[0].id).toBe('unknown');
  });

  it('respects field casing and Date coercion in the runtime schema', () => {
    const { runtime: snake } = runtime(USERS_SQL, { fieldCasing: 'snake', timestampsAsDate: true });
    const outcome = validateSample(
      snake.tables[0].schema,
      JSON.stringify({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', email: 'a', full_name: 'A', role: 'admin', is_active: true, created_at: '2026-01-01T00:00:00Z' }),
    );
    expect(outcome.status).toBe('valid');
    if (outcome.status === 'valid') expect((outcome.data as { created_at: unknown }).created_at).toBeInstanceOf(Date);
  });

  it('returns empty for blank input', () => {
    expect(validateSample(schema, '   ').status).toBe('empty');
  });
});

describe('sample row factory', () => {
  it('produces rows that pass validation for every preset table and option combination', () => {
    const combos: Partial<GeneratorOptions>[] = [
      {},
      { fieldCasing: 'snake', timestampsAsDate: true },
      { fieldCasing: 'pascal', nullableStyle: 'nullable' },
      { nullableStyle: 'optional', defaultsOptional: true },
    ];
    for (const preset of PRESETS) {
      for (const combo of combos) {
        const { model, runtime: rt } = runtime(preset.sql, combo, preset.dialect);
        expect(rt.error, preset.id).toBeUndefined();
        model.tables.forEach((table, index) => {
          const outcome = validateSample(rt.tables[index].schema, JSON.stringify(createSampleRow(table)));
          expect(outcome.status, `${preset.id}/${table.table.name}/${JSON.stringify(combo)}`).toBe('valid');
        });
      }
    }
  });

  it('produces invalid rows that fail validation', () => {
    const { model, runtime: rt } = runtime(USERS_SQL);
    const outcome = validateSample(rt.tables[0].schema, JSON.stringify(createInvalidSampleRow(model.tables[0])));
    expect(outcome.status).toBe('invalid');
  });
});
