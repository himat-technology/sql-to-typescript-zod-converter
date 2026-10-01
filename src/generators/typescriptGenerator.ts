import type { EnumModel, FieldModel, GenerationModel, TableModel } from './model';
import type { TsSyntax } from './options';

const INDENT = '  ';

function escapeComment(text: string): string {
  return text.replace(/\*\//g, '*\\/');
}

/** Renders a JSDoc block; single lines become `/** text *\/`. */
export function renderDocComment(lines: string[], indent = ''): string[] {
  if (lines.length === 0) return [];
  if (lines.length === 1) return [`${indent}/** ${escapeComment(lines[0])} */`];
  return [`${indent}/**`, ...lines.map((l) => `${indent} * ${escapeComment(l)}`), `${indent} */`];
}

export function renderTsField(field: FieldModel): string[] {
  const type = field.nullable ? `${field.mapped.tsType} | null` : field.mapped.tsType;
  return [...renderDocComment(field.docs, INDENT), `${INDENT}${field.propertyKey}${field.optional ? '?' : ''}: ${type};`];
}

export function renderTsEnum(enumModel: EnumModel): string[] {
  const union = enumModel.values.length > 0 ? enumModel.values.map((v) => JSON.stringify(v)).join(' | ') : 'string';
  return [`export type ${enumModel.typeName} = ${union};`];
}

export function renderTsTable(table: TableModel, syntax: TsSyntax): string[] {
  const lines = [...renderDocComment(table.docs)];
  const body = table.fields.flatMap(renderTsField);
  if (syntax === 'interface') {
    lines.push(body.length ? `export interface ${table.typeName} {` : `export interface ${table.typeName} {}`);
    if (body.length) lines.push(...body, '}');
  } else {
    lines.push(body.length ? `export type ${table.typeName} = {` : `export type ${table.typeName} = Record<string, never>;`);
    if (body.length) lines.push(...body, '};');
  }
  return lines;
}

/** Plain TypeScript declarations (no Zod), one per enum and table. */
export function generateTypeScript(model: GenerationModel): string[] {
  const blocks: string[] = [];
  for (const enumModel of model.enums) blocks.push(renderTsEnum(enumModel).join('\n'));
  for (const table of model.tables) blocks.push(renderTsTable(table, model.options.tsSyntax).join('\n'));
  return blocks;
}
