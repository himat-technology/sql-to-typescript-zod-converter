import { getDialect } from '../parser/dialects';
import type { DatabaseColumn, DatabaseEnum, DatabaseSchema, DatabaseTable, ParseIssue, SqlDialect } from '../parser/types';
import { applyCasing } from './casingUtils';
import { formatPropertyKey, NameRegistry, toSchemaName, toTypeName } from './identifierUtils';
import type { GeneratorOptions } from './options';
import { mapColumnType, type EnumReference, type MappedType } from './typeMapping';

export interface FieldModel {
  column: DatabaseColumn;
  /** Property name after casing, e.g. `fullName`. */
  key: string;
  /** Key as printed in code (quoted when it isn't a valid identifier). */
  propertyKey: string;
  mapped: MappedType;
  /** Emit `| null` / `.nullable()`. */
  nullable: boolean;
  /** Emit `?` / `.optional()`. */
  optional: boolean;
  docs: string[];
}

export interface TableModel {
  table: DatabaseTable;
  typeName: string;
  schemaName: string;
  fields: FieldModel[];
  docs: string[];
}

export interface EnumModel {
  source: DatabaseEnum;
  typeName: string;
  schemaName: string;
  values: string[];
}

export interface GenerationModel {
  dialect: SqlDialect;
  options: GeneratorOptions;
  tables: TableModel[];
  enums: EnumModel[];
  warnings: ParseIssue[];
}

function qualifiedName(name: string, schema?: string) {
  return schema ? `${schema}.${name}` : name;
}

function buildFieldDocs(column: DatabaseColumn): string[] {
  const docs: string[] = [];
  if (column.comment) docs.push(...column.comment.split('\n').map((l) => l.trim()).filter(Boolean));
  const meta: string[] = [column.rawType || (column.generated ? 'computed' : 'no declared type')];
  if (column.primaryKey) meta.push('primary key');
  else if (column.unique) meta.push('unique');
  if (column.autoIncrement) meta.push('auto-increment');
  if (column.generated) meta.push('generated');
  if (column.defaultValue !== undefined) meta.push(`default: ${column.defaultValue.replace(/\s+/g, ' ')}`);
  if (column.references) {
    const cols = column.references.columns.length ? `(${column.references.columns.join(', ')})` : '';
    meta.push(`references ${column.references.table}${cols}`);
  }
  docs.push(meta.join(' · '));
  return docs;
}

/**
 * Resolves names, types and nullability for every table so the TypeScript and Zod printers (and
 * the runtime validator) all work from exactly the same decisions.
 */
export function buildGenerationModel(schema: DatabaseSchema, dialect: SqlDialect, options: GeneratorOptions): GenerationModel {
  const warnings: ParseIssue[] = [];
  const typeNames = new NameRegistry();
  const dialectConfig = getDialect(dialect);

  // Disambiguate tables that share a name across schemas (auth.users vs public.users).
  const nameCounts = new Map<string, number>();
  for (const table of schema.tables) {
    const key = toTypeName(table.name, options.singularizeNames).toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const enums: EnumModel[] = schema.enums.map((source) => {
    const typeName = typeNames.claim(toTypeName(source.name, false));
    return { source, typeName, schemaName: toSchemaName(typeName), values: source.values };
  });
  const enumByName = new Map(enums.map((e) => [e.source.name.toUpperCase(), e]));

  const unknownTypes = new Map<string, string[]>();

  const tables: TableModel[] = schema.tables.map((table) => {
    let baseName = toTypeName(table.name, options.singularizeNames);
    if ((nameCounts.get(baseName.toLowerCase()) ?? 0) > 1 && table.schema) {
      baseName = toTypeName(`${table.schema}_${table.name}`, options.singularizeNames);
    }
    const typeName = typeNames.claim(baseName);
    const schemaName = toSchemaName(typeName);

    const usedKeys = new Map<string, string>();
    const fields: FieldModel[] = table.columns.map((column, index) => {
      let key = applyCasing(column.name, options.fieldCasing);
      if (!key || !/[A-Za-z\d\u00C0-\uFFFF]/.test(key)) key = column.name.trim() || `column${index + 1}`;
      const lower = key.toLowerCase();
      if (usedKeys.has(lower)) {
        const original = key;
        let counter = 2;
        while (usedKeys.has(`${original}${counter}`.toLowerCase())) counter++;
        key = `${original}${counter}`;
        warnings.push({
          severity: 'warning',
          message: `Columns \`${usedKeys.get(lower)}\` and \`${column.name}\` in \`${table.name}\` both become \`${original}\`; renamed the second to \`${key}\``,
          suggestion: 'Choose a different field casing or rename one of the columns.',
        });
      }
      usedKeys.set(key.toLowerCase(), column.name);

      const typeSegment = column.sqlType.includes('.') ? column.sqlType.slice(column.sqlType.lastIndexOf('.') + 1) : column.sqlType;
      const enumModel = enumByName.get(typeSegment);
      const enumRef: EnumReference | undefined = enumModel ? { typeName: enumModel.typeName, schemaName: enumModel.schemaName } : undefined;
      const mapped = mapColumnType(column, dialectConfig.id, options, enumRef);

      if (!mapped.known && column.sqlType) {
        const locations = unknownTypes.get(column.sqlType) ?? [];
        locations.push(`${table.name}.${column.name}`);
        unknownTypes.set(column.sqlType, locations);
      }

      const hasGeneratedValue = column.defaultValue !== undefined || column.autoIncrement || column.generated;
      const optional =
        (column.nullable && options.nullableStyle !== 'nullable') || (options.defaultsOptional && hasGeneratedValue);
      const nullable = column.nullable && options.nullableStyle !== 'optional';

      return {
        column,
        key,
        propertyKey: formatPropertyKey(key),
        mapped,
        nullable,
        optional,
        docs: options.includeComments ? buildFieldDocs(column) : [],
      };
    });

    const docs: string[] = [];
    if (options.includeComments) {
      docs.push(`Table: ${qualifiedName(table.name, table.schema)}`);
      if (table.comment) docs.push(...table.comment.split('\n').map((l) => l.trim()).filter(Boolean));
      if (table.primaryKey.length > 1) docs.push(`Composite primary key: (${table.primaryKey.join(', ')})`);
      for (const unique of table.uniqueConstraints.filter((u) => u.length > 1)) docs.push(`Unique: (${unique.join(', ')})`);
    }

    return { table, typeName, schemaName, fields, docs };
  });

  for (const [type, locations] of unknownTypes) {
    const shown = locations.slice(0, 3).join(', ') + (locations.length > 3 ? `, +${locations.length - 3} more` : '');
    warnings.push({
      severity: 'warning',
      message: `Unsupported SQL type: ${type} (${shown}) — mapped to string`,
      suggestion: 'Add the type to TYPE_RULES in src/generators/typeMapping.ts for a precise mapping.',
    });
  }

  return { dialect, options, tables, enums, warnings };
}
