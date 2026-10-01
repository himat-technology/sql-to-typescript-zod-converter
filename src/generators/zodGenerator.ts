import type { EnumModel, FieldModel, GenerationModel, TableModel } from './model';
import { renderDocComment } from './typescriptGenerator';

const INDENT = '  ';

/** Full validator for a field: base type, then `.nullable()`, then `.optional()`. */
export function zodFieldExpression(field: FieldModel): string {
  let expression = field.mapped.zod;
  if (field.nullable) expression += '.nullable()';
  if (field.optional) expression += '.optional()';
  return expression;
}

export function zodEnumExpression(enumModel: EnumModel): string {
  if (enumModel.values.length === 0) return 'z.string()';
  return `z.enum([${enumModel.values.map((v) => JSON.stringify(v)).join(', ')}])`;
}

/** `z.object({ ... })` for a table. `withDocs` adds JSDoc comments above each property. */
export function zodObjectExpression(table: TableModel, withDocs: boolean): string {
  if (table.fields.length === 0) return 'z.object({})';
  const lines = ['z.object({'];
  for (const field of table.fields) {
    if (withDocs) lines.push(...renderDocComment(field.docs, INDENT));
    lines.push(`${INDENT}${field.propertyKey}: ${zodFieldExpression(field)},`);
  }
  lines.push('})');
  return lines.join('\n');
}

export interface ZodRenderOptions {
  /** Emit `export type X = z.infer<...>` (or an interface extending it) after each schema. */
  includeTypes: boolean;
}

export function renderZodEnum(enumModel: EnumModel, options: ZodRenderOptions): string {
  const lines = [`export const ${enumModel.schemaName} = ${zodEnumExpression(enumModel)};`];
  if (options.includeTypes) lines.push(`export type ${enumModel.typeName} = z.infer<typeof ${enumModel.schemaName}>;`);
  return lines.join('\n');
}

export function renderZodTable(table: TableModel, model: GenerationModel, options: ZodRenderOptions): string {
  const lines = [...renderDocComment(table.docs), `export const ${table.schemaName} = ${zodObjectExpression(table, model.options.includeComments)};`];
  if (options.includeTypes) {
    lines.push('');
    if (model.options.tsSyntax === 'interface') {
      lines.push(`export interface ${table.typeName} extends z.infer<typeof ${table.schemaName}> {}`);
    } else {
      lines.push(`export type ${table.typeName} = z.infer<typeof ${table.schemaName}>;`);
    }
  }
  return lines.join('\n');
}

export function generateZod(model: GenerationModel, options: ZodRenderOptions): string[] {
  return [
    ...model.enums.map((e) => renderZodEnum(e, options)),
    ...model.tables.map((t) => renderZodTable(t, model, options)),
  ];
}

/**
 * Plain JavaScript version of the generated schemas, used by the in-browser row tester. It contains
 * the exact same validator expressions as the exported TypeScript, minus type-only syntax.
 * The body expects `z` as a parameter and returns the table schemas in table order.
 */
export function buildZodRuntimeModule(model: GenerationModel): string {
  const lines = ['"use strict";'];
  for (const enumModel of model.enums) lines.push(`const ${enumModel.schemaName} = ${zodEnumExpression(enumModel)};`);
  for (const table of model.tables) lines.push(`const ${table.schemaName} = ${zodObjectExpression(table, false)};`);
  lines.push(`return [${model.tables.map((t) => t.schemaName).join(', ')}];`);
  return lines.join('\n');
}
