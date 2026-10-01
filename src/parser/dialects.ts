import type { DialectConfig } from './dialect';
import { mysqlDialect } from './mysqlParser';
import { postgresDialect } from './postgresParser';
import { sqliteDialect } from './sqliteParser';
import { tsqlDialect } from './tsqlParser';
import type { SqlDialect } from './types';

export const DIALECTS: Record<SqlDialect, DialectConfig> = {
  postgresql: postgresDialect,
  mysql: mysqlDialect,
  sqlite: sqliteDialect,
  tsql: tsqlDialect,
};

export const DIALECT_OPTIONS: ReadonlyArray<{ id: SqlDialect; label: string }> = [
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'tsql', label: 'T-SQL' },
];

export function getDialect(id: SqlDialect): DialectConfig {
  return DIALECTS[id] ?? postgresDialect;
}
