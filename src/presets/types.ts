import type { SqlDialect } from '../parser/types';

export interface SqlPreset {
  id: string;
  label: string;
  dialect: SqlDialect;
  description: string;
  sql: string;
}
