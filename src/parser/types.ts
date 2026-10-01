export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'tsql';

export interface ColumnReference {
  table: string;
  columns: string[];
}

export interface DatabaseColumn {
  name: string;
  /** Normalized, upper-cased base type without parameters, e.g. `VARCHAR`, `TIMESTAMPTZ`. Empty when the column has no declared type. */
  sqlType: string;
  /** The type exactly as written in the source, e.g. `VARCHAR(255)` or `numeric(10, 2)[]`. */
  rawType: string;
  /** Type parameters, e.g. `['10', '2']` for `DECIMAL(10,2)`. String literal parameters are unquoted. */
  typeParams: string[];
  isArray: boolean;
  /** Number of array dimensions, e.g. 2 for `int[][]`; 0 when not an array. */
  arrayDimensions: number;
  unsigned: boolean;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  /** Computed / generated column (`GENERATED ALWAYS AS (...)`, T-SQL `AS (...)`). */
  generated: boolean;
  defaultValue?: string;
  /** Allowed values from MySQL `ENUM(...)`, a PostgreSQL enum type or a `CHECK (col IN (...))` constraint. */
  enumValues?: string[];
  comment?: string;
  references?: ColumnReference;
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  primaryKey: string[];
  uniqueConstraints: string[][];
  comment?: string;
}

export interface DatabaseEnum {
  name: string;
  schema?: string;
  values: string[];
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  enums: DatabaseEnum[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ParseIssue {
  severity: IssueSeverity;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ParseResult {
  schema: DatabaseSchema;
  issues: ParseIssue[];
  /** Number of statements that were recognised but intentionally skipped (indexes, inserts, ...). */
  skippedStatements: number;
}
