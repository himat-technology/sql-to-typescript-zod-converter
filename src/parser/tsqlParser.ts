import type { DialectConfig } from './dialect';

export const tsqlDialect: DialectConfig = {
  id: 'tsql',
  label: 'T-SQL',
  identifierQuotes: [
    ['[', ']'],
    ['"', '"'],
    ['`', '`'],
  ],
  doubleQuotedStrings: false,
  backslashEscapes: false,
  hashComments: false,
  dollarQuotedStrings: false,
  sigilIdentifiers: true,
  batchSeparator: 'GO',
  optionalSemicolons: true,
  typeAliases: {
    // In SQL Server TIMESTAMP is a synonym for ROWVERSION (binary), not a date/time type.
    TIMESTAMP: 'ROWVERSION',
    DATETIME2: 'DATETIME',
    SMALLDATETIME: 'DATETIME',
    DATETIMEOFFSET: 'TIMESTAMPTZ',
    BIT: 'BOOLEAN',
  },
  booleanBitTypes: true,
  serialTypes: new Set(),
};
