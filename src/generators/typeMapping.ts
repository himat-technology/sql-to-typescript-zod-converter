import type { DatabaseColumn, SqlDialect } from '../parser/types';

export type FieldKind =
  | 'string'
  | 'uuid'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'json'
  | 'enum'
  | 'binary'
  | 'unknown';

interface TypeRule {
  kind: FieldKind;
  types: string[];
  /** Whether `(n)` is a maximum string length. */
  lengthParam?: boolean;
  /** Date/time type carries an explicit UTC offset. */
  withTimezone?: boolean;
}

/**
 * SQL type → field kind rules. To support a new SQL type, add its normalized upper-case name to an
 * existing rule (or add a new rule). Names are matched after alias normalization in the parser.
 */
export const TYPE_RULES: TypeRule[] = [
  { kind: 'uuid', types: ['UUID', 'UNIQUEIDENTIFIER'] },
  {
    kind: 'integer',
    types: ['INT', 'INTEGER', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'BIGINT', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'YEAR', 'OID'],
  },
  {
    kind: 'number',
    types: ['DECIMAL', 'NUMERIC', 'DEC', 'FIXED', 'NUMBER', 'FLOAT', 'REAL', 'DOUBLE', 'MONEY', 'SMALLMONEY'],
  },
  {
    kind: 'string',
    lengthParam: true,
    types: ['VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'VARCHAR2', 'NVARCHAR2', 'STRING'],
  },
  {
    kind: 'string',
    types: [
      'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'NTEXT', 'CLOB', 'NCLOB', 'CITEXT', 'NAME', 'XML', 'INET', 'CIDR',
      'MACADDR', 'MACADDR8', 'TSVECTOR', 'TSQUERY', 'INTERVAL', 'SET', 'VARBIT', 'BIT', 'LTREE', 'HSTORE', 'GEOMETRY',
      'GEOGRAPHY', 'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE', 'LINESTRING', 'MULTIPOINT',
      'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION', 'HIERARCHYID', 'SYSNAME', 'INT4RANGE',
      'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE', 'PG_LSN', 'TXID_SNAPSHOT',
    ],
  },
  { kind: 'boolean', types: ['BOOLEAN', 'BOOL'] },
  { kind: 'date', types: ['DATE'] },
  { kind: 'datetime', types: ['TIMESTAMP', 'DATETIME'] },
  { kind: 'datetime', types: ['TIMESTAMPTZ'], withTimezone: true },
  { kind: 'time', types: ['TIME', 'TIMETZ'] },
  { kind: 'json', types: ['JSON', 'JSONB'] },
  { kind: 'unknown', types: ['ANY', 'SQL_VARIANT'] },
  { kind: 'enum', types: ['ENUM'] },
  {
    kind: 'binary',
    types: ['BYTEA', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BINARY', 'VARBINARY', 'IMAGE', 'ROWVERSION', 'RAW'],
  },
];

const RULE_LOOKUP = new Map<string, TypeRule>();
for (const rule of TYPE_RULES) {
  for (const type of rule.types) RULE_LOOKUP.set(type, rule);
}

const UUID_DEFAULT = /\b(gen_random_uuid|uuid_generate_v[1-5]|newid|newsequentialid|uuid)\s*\(/i;

export interface ResolvedKind {
  kind: FieldKind;
  /** False when the SQL type wasn't recognised and a fallback was used. */
  known: boolean;
  maxLength?: number;
  withTimezone: boolean;
}

/** Determines the semantic kind of a column, independent of output options. */
export function resolveColumnKind(column: DatabaseColumn, dialect: SqlDialect): ResolvedKind {
  const base = column.sqlType;
  const firstParam = column.typeParams[0]?.trim();

  if (!base) {
    // SQLite columns without a declared type accept any value.
    const anyValue = column.generated || dialect === 'sqlite';
    return { kind: anyValue ? 'unknown' : 'string', known: anyValue, withTimezone: false };
  }

  if (dialect === 'mysql' && ((base === 'BIT' && (!firstParam || firstParam === '1')) || (base === 'TINYINT' && firstParam === '1'))) {
    return { kind: 'boolean', known: true, withTimezone: false };
  }

  const lastSegment = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : base;
  const rule = RULE_LOOKUP.get(base) ?? RULE_LOOKUP.get(lastSegment);

  let resolved: ResolvedKind;
  if (rule) {
    const length = rule.lengthParam && firstParam && /^\d+$/.test(firstParam) ? Number(firstParam) : undefined;
    resolved = { kind: rule.kind, known: true, maxLength: length, withTimezone: rule.withTimezone ?? false };
  } else if (column.enumValues?.length) {
    // Custom type backed by CREATE TYPE ... AS ENUM.
    return { kind: 'enum', known: true, withTimezone: false };
  } else {
    resolved = { ...affinityFallback(base), withTimezone: false };
  }

  if (column.enumValues?.length && (resolved.kind === 'string' || resolved.kind === 'enum')) {
    return { kind: 'enum', known: true, withTimezone: false };
  }
  if (resolved.kind === 'enum') {
    // ENUM without values: fall back to a plain string.
    return { kind: 'string', known: true, withTimezone: false };
  }
  if (resolved.kind === 'string' && column.defaultValue && UUID_DEFAULT.test(column.defaultValue)) {
    return { kind: 'uuid', known: true, withTimezone: false };
  }
  return resolved;
}

/** SQLite-style type affinity rules, used as a fallback for unrecognised type names. */
function affinityFallback(base: string): { kind: FieldKind; known: boolean } {
  if (base.includes('INT')) return { kind: 'integer', known: true };
  if (/CHAR|CLOB|TEXT|STRING/.test(base)) return { kind: 'string', known: true };
  if (base.includes('BLOB')) return { kind: 'binary', known: true };
  if (/REAL|FLOA|DOUB|DECIMAL|NUMERIC/.test(base)) return { kind: 'number', known: true };
  if (base.includes('BOOL')) return { kind: 'boolean', known: true };
  if (base.includes('TIMESTAMP') || base.includes('DATETIME')) return { kind: 'datetime', known: true };
  if (base.includes('JSON')) return { kind: 'json', known: true };
  return { kind: 'string', known: false };
}

export interface TypeMappingOptions {
  timestampsAsDate: boolean;
  coerceDates: boolean;
}

export interface EnumReference {
  typeName: string;
  schemaName: string;
}

export interface MappedType {
  kind: FieldKind;
  known: boolean;
  tsType: string;
  zod: string;
  isArray: boolean;
  enumValues?: string[];
  maxLength?: number;
  withTimezone: boolean;
}

function scalarTsType(kind: FieldKind, options: TypeMappingOptions, enumValues?: string[], enumRef?: EnumReference): string {
  switch (kind) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return options.timestampsAsDate ? 'Date' : 'string';
    case 'json':
      return 'Record<string, unknown> | unknown[]';
    case 'enum':
      if (enumRef) return enumRef.typeName;
      return enumValues && enumValues.length > 0 ? enumValues.map((v) => JSON.stringify(v)).join(' | ') : 'string';
    case 'unknown':
      return 'unknown';
    default:
      return 'string';
  }
}

function scalarZod(resolved: ResolvedKind, column: DatabaseColumn, options: TypeMappingOptions, enumRef?: EnumReference): string {
  const dateValidator = options.coerceDates ? 'z.coerce.date()' : 'z.date()';
  switch (resolved.kind) {
    case 'uuid':
      return 'z.string().uuid()';
    case 'integer':
      return column.unsigned ? 'z.number().int().nonnegative()' : 'z.number().int()';
    case 'number':
      return column.unsigned ? 'z.number().nonnegative()' : 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'date':
      return options.timestampsAsDate ? dateValidator : 'z.string().date()';
    case 'datetime':
      if (options.timestampsAsDate) return dateValidator;
      return resolved.withTimezone ? 'z.string().datetime({ offset: true })' : 'z.string().datetime({ local: true })';
    case 'json':
      return 'z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())])';
    case 'enum':
      if (enumRef) return enumRef.schemaName;
      return column.enumValues && column.enumValues.length > 0 ? `z.enum([${column.enumValues.map((v) => JSON.stringify(v)).join(', ')}])` : 'z.string()';
    case 'unknown':
      return 'z.unknown()';
    case 'string':
      return resolved.maxLength !== undefined ? `z.string().max(${resolved.maxLength})` : 'z.string()';
    default:
      return 'z.string()';
  }
}

/** Maps a column to its TypeScript type and Zod validator expression (without nullability). */
export function mapColumnType(column: DatabaseColumn, dialect: SqlDialect, options: TypeMappingOptions, enumRef?: EnumReference): MappedType {
  const resolved = resolveColumnKind(column, dialect);
  let tsType = scalarTsType(resolved.kind, options, column.enumValues, enumRef);
  let zod = scalarZod(resolved, column, options, enumRef);

  if (column.isArray) {
    const dimensions = Math.max(1, column.arrayDimensions);
    if (tsType.includes('|')) tsType = `(${tsType})`;
    tsType += '[]'.repeat(dimensions);
    for (let i = 0; i < dimensions; i++) zod = `z.array(${zod})`;
  }

  return {
    kind: resolved.kind,
    known: resolved.known,
    tsType,
    zod,
    isArray: column.isArray,
    enumValues: resolved.kind === 'enum' ? column.enumValues : undefined,
    maxLength: resolved.maxLength,
    withTimezone: resolved.withTimezone,
  };
}
