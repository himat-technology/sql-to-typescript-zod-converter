import type { DialectConfig } from './dialect';

export const sqliteDialect: DialectConfig = {
  id: 'sqlite',
  label: 'SQLite',
  identifierQuotes: [
    ['"', '"'],
    ['`', '`'],
    ['[', ']'],
  ],
  doubleQuotedStrings: false,
  backslashEscapes: false,
  hashComments: false,
  dollarQuotedStrings: false,
  sigilIdentifiers: false,
  optionalSemicolons: false,
  typeAliases: {
    BOOL: 'BOOLEAN',
  },
  booleanBitTypes: false,
  serialTypes: new Set(),
};
