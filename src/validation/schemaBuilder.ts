import { z } from 'zod';
import type { GenerationModel } from '../generators/model';
import { buildZodRuntimeModule } from '../generators/zodGenerator';

export interface RuntimeTableSchema {
  tableName: string;
  typeName: string;
  schemaName: string;
  schema: z.ZodTypeAny;
}

export interface RuntimeSchemas {
  tables: RuntimeTableSchema[];
  /** The JavaScript that was evaluated (handy for debugging / tests). */
  source: string;
  error?: string;
}

/**
 * Evaluates the generated Zod code with the real `zod` library, so the row tester validates against
 * exactly what the user would paste into their project. Everything runs locally; the code is built
 * from sanitized identifiers and JSON-escaped literals only.
 */
export function buildRuntimeSchemas(model: GenerationModel): RuntimeSchemas {
  const source = buildZodRuntimeModule(model);
  try {
    const factory = new Function('z', source) as (zod: typeof z) => z.ZodTypeAny[];
    const schemas = factory(z);
    return {
      source,
      tables: model.tables.map((table, index) => ({
        tableName: table.table.schema ? `${table.table.schema}.${table.table.name}` : table.table.name,
        typeName: table.typeName,
        schemaName: table.schemaName,
        schema: schemas[index],
      })),
    };
  } catch (error) {
    return { source, tables: [], error: error instanceof Error ? error.message : String(error) };
  }
}
