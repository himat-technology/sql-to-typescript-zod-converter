import type { DialectConfig } from './dialect';

/** Words that may appear after the first word of a multi-word type name. */
export const TYPE_CONTINUATION_WORDS = new Set([
  'VARYING',
  'CHARACTER',
  'CHAR',
  'PRECISION',
  'UNSIGNED',
  'SIGNED',
  'ZEROFILL',
  'WITH',
  'WITHOUT',
  'TIME',
  'ZONE',
  'LOCAL',
  'BIG',
  'INT',
  'INTEGER',
  'NATIONAL',
  'NATIVE',
  'NCHAR',
  'VARCHAR',
  'DOUBLE',
  'LONG',
  'VARBINARY',
  'BINARY',
  'LARGE',
  'OBJECT',
  'TEXT',
  'BLOB',
  'RAW',
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'MONTH',
  'YEAR',
  'TO',
]);

/** Modifiers allowed after the parameter list, e.g. `INT(11) UNSIGNED`, `TIMESTAMP(3) WITH TIME ZONE`. */
export const POST_PARAM_TYPE_WORDS = new Set(['UNSIGNED', 'SIGNED', 'ZEROFILL', 'VARYING', 'PRECISION', 'WITH', 'WITHOUT', 'TIME', 'ZONE', 'LOCAL']);

const GENERIC_TYPE_ALIASES: Record<string, string> = {
  'CHARACTER VARYING': 'VARCHAR',
  'CHAR VARYING': 'VARCHAR',
  'VARYING CHARACTER': 'VARCHAR',
  'NATIONAL CHARACTER VARYING': 'NVARCHAR',
  'NATIONAL CHAR VARYING': 'NVARCHAR',
  'NATIONAL VARCHAR': 'NVARCHAR',
  'NCHAR VARYING': 'NVARCHAR',
  'NATIONAL CHARACTER': 'NCHAR',
  'NATIONAL CHAR': 'NCHAR',
  'NATIVE CHARACTER': 'NCHAR',
  CHARACTER: 'CHAR',
  'DOUBLE PRECISION': 'DOUBLE',
  'TIMESTAMP WITH TIME ZONE': 'TIMESTAMPTZ',
  'TIMESTAMP WITH LOCAL TIME ZONE': 'TIMESTAMPTZ',
  'TIMESTAMP WITHOUT TIME ZONE': 'TIMESTAMP',
  'TIME WITH TIME ZONE': 'TIMETZ',
  'TIME WITHOUT TIME ZONE': 'TIME',
  'BIT VARYING': 'VARBIT',
  'BINARY VARYING': 'VARBINARY',
  'CHARACTER LARGE OBJECT': 'CLOB',
  'BINARY LARGE OBJECT': 'BLOB',
  'BIG INT': 'BIGINT',
  'LONG VARBINARY': 'MEDIUMBLOB',
  'LONG RAW': 'BLOB',
};

const KNOWN_TYPE_NAMES = new Set([
  'INT', 'INTEGER', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'BIGINT', 'SERIAL', 'BIGSERIAL', 'DECIMAL', 'NUMERIC', 'FLOAT',
  'REAL', 'DOUBLE', 'MONEY', 'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'CHARACTER', 'TEXT', 'NTEXT', 'TINYTEXT', 'MEDIUMTEXT',
  'LONGTEXT', 'CLOB', 'CITEXT', 'BOOLEAN', 'BOOL', 'BIT', 'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATETIME', 'DATETIME2',
  'UUID', 'UNIQUEIDENTIFIER', 'JSON', 'JSONB', 'BLOB', 'BYTEA', 'BINARY', 'VARBINARY', 'ENUM', 'SET', 'INTERVAL', 'YEAR',
]);

export function isKnownTypeName(upper: string): boolean {
  return KNOWN_TYPE_NAMES.has(upper);
}

export interface NormalizedType {
  base: string;
  unsigned: boolean;
}

/** Turns the words of a declared type into a canonical upper-case base name. */
export function normalizeTypeName(words: string[], dialect: DialectConfig): NormalizedType {
  let unsigned = false;
  const kept: string[] = [];
  for (const word of words) {
    const upper = word.toUpperCase();
    if (upper === 'UNSIGNED') {
      unsigned = true;
      continue;
    }
    if (upper === 'SIGNED' || upper === 'ZEROFILL') continue;
    kept.push(upper);
  }

  let base = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (base === 'BIG INT' && unsigned) base = 'BIGINT';
  if (base.startsWith('INTERVAL ')) base = 'INTERVAL';
  base = GENERIC_TYPE_ALIASES[base] ?? base;
  base = dialect.typeAliases[base] ?? base;
  return { base, unsigned };
}
