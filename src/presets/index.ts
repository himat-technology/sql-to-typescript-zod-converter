import { mysqlAuth } from './mysqlAuth';
import { postgresEcommerce } from './postgresEcommerce';
import { sqliteWebApp } from './sqliteWebApp';
import { tsqlSaaS } from './tsqlSaaS';
import type { SqlPreset } from './types';

export type { SqlPreset } from './types';

export const PRESETS: readonly SqlPreset[] = [postgresEcommerce, mysqlAuth, sqliteWebApp, tsqlSaaS];
