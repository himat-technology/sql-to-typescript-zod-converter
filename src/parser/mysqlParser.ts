import type { DialectConfig } from './dialect';

export const mysqlDialect: DialectConfig = {
  id: 'mysql',
  label: 'MySQL',
  identifierQuotes: [['`', '`']],
  doubleQuotedStrings: true,
  backslashEscapes: true,
  hashComments: true,
  dollarQuotedStrings: false,
  sigilIdentifiers: false,
  optionalSemicolons: false,
  typeAliases: {
    BOOL: 'BOOLEAN',
    INT1: 'TINYINT',
    INT2: 'SMALLINT',
    INT3: 'MEDIUMINT',
    INT4: 'INT',
    INT8: 'BIGINT',
    FLOAT4: 'FLOAT',
    FLOAT8: 'DOUBLE',
    'LONG VARCHAR': 'MEDIUMTEXT',
    LONG: 'MEDIUMTEXT',
  },
  booleanBitTypes: true,
  // MySQL SERIAL is an alias for BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE.
  serialTypes: new Set(['SERIAL']),
};
