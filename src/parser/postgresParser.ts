import type { DialectConfig } from './dialect';

export const postgresDialect: DialectConfig = {
  id: 'postgresql',
  label: 'PostgreSQL',
  identifierQuotes: [
    ['"', '"'],
    ['`', '`'],
  ],
  doubleQuotedStrings: false,
  backslashEscapes: false,
  hashComments: false,
  dollarQuotedStrings: true,
  sigilIdentifiers: false,
  optionalSemicolons: false,
  typeAliases: {
    INT2: 'SMALLINT',
    INT4: 'INTEGER',
    INT8: 'BIGINT',
    FLOAT4: 'REAL',
    FLOAT8: 'DOUBLE',
    BOOL: 'BOOLEAN',
    SERIAL2: 'SMALLSERIAL',
    SERIAL4: 'SERIAL',
    SERIAL8: 'BIGSERIAL',
    BPCHAR: 'CHAR',
  },
  booleanBitTypes: false,
  serialTypes: new Set(['SERIAL', 'BIGSERIAL', 'SMALLSERIAL']),
};
