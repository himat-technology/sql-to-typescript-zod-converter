import type { SqlDialect } from './types';

export interface DialectConfig {
  id: SqlDialect;
  label: string;
  /** Pairs of opening/closing characters that delimit quoted identifiers. */
  identifierQuotes: ReadonlyArray<readonly [open: string, close: string]>;
  /** Whether `"..."` is a string literal (MySQL default) rather than an identifier. */
  doubleQuotedStrings: boolean;
  /** Whether backslash escapes are honoured inside string literals. */
  backslashEscapes: boolean;
  /** Whether `#` starts a line comment. */
  hashComments: boolean;
  /** Whether PostgreSQL `$tag$ ... $tag$` strings are recognised. */
  dollarQuotedStrings: boolean;
  /** Whether `@var` / `#temp` style identifiers are recognised. */
  sigilIdentifiers: boolean;
  /** Batch separator keyword that terminates statements on its own (T-SQL `GO`). */
  batchSeparator?: string;
  /** Whether statements may legally omit the terminating semicolon. */
  optionalSemicolons: boolean;
  /** Dialect specific type aliases applied after generic normalization (keys and values are upper-case). */
  typeAliases: Readonly<Record<string, string>>;
  /** Whether `BIT(1)` / `TINYINT(1)` should be treated as booleans. */
  booleanBitTypes: boolean;
  /** Types that imply `NOT NULL` + auto increment, e.g. PostgreSQL `SERIAL`. */
  serialTypes: ReadonlySet<string>;
}
