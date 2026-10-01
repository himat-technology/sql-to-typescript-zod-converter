import type { FieldModel, TableModel } from '../generators/model';

const SAMPLE_UUIDS = [
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '9b2e4c1a-7d3f-4e8b-9a6c-2f1d0e5b8c7a',
  '3c8f1e2d-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
];

function stringSample(name: string, maxLength?: number): string {
  const n = name.toLowerCase();
  let value = 'sample';
  if (n.includes('email')) value = 'alex@himat.tech';
  else if (/(^|_)(full_?name|display_?name|name)$/.test(n) || n === 'fullname') value = 'Alex Dev';
  else if (n.includes('first_name') || n === 'firstname') value = 'Alex';
  else if (n.includes('last_name') || n === 'lastname') value = 'Dev';
  else if (n.includes('user_name') || n === 'username') value = 'alexdev';
  else if (/url|website|avatar|image|link/.test(n)) value = 'https://himat.tech';
  else if (n.includes('phone')) value = '+1-555-0100';
  else if (n.includes('slug')) value = 'sample-slug';
  else if (n.includes('sku')) value = 'SKU-1001';
  else if (n.includes('title')) value = 'Sample title';
  else if (/description|bio|body|content|notes?$/.test(n)) value = 'Sample description';
  else if (/password|hash|secret/.test(n)) value = '$2b$12$abcdefghijklmnopqrstuv';
  else if (/token/.test(n)) value = 'tok_3f9a2b7c1d';
  else if (/ip_?address|^ip$/.test(n)) value = '203.0.113.42';
  else if (n.includes('country')) value = 'US';
  else if (n.includes('currency')) value = 'USD';
  else if (n.includes('status')) value = 'active';
  else if (n.includes('role')) value = 'admin';
  else if (/address/.test(n)) value = '1 Infinite Loop, Cupertino, CA';
  else if (/agent/.test(n)) value = 'Mozilla/5.0';
  else if (/code/.test(n)) value = 'ABC123';
  else if (/plan|tier/.test(n)) value = 'pro';
  else if (/city/.test(n)) value = 'Bengaluru';
  return maxLength !== undefined && value.length > maxLength ? value.slice(0, Math.max(1, maxLength)) : value;
}

function numberSample(name: string, integer: boolean): number {
  const n = name.toLowerCase();
  if (/(^|_)id$|_id$/.test(n) || n === 'id') return 1;
  if (/quantity|qty|count|stock|seats|attempts/.test(n)) return 3;
  if (/price|amount|total|cost|balance|fee|mrr/.test(n)) return integer ? 4999 : 49.99;
  if (/year/.test(n)) return 2026;
  if (/age/.test(n)) return 30;
  return integer ? 42 : 3.14;
}

function scalarSample(field: FieldModel, uuidIndex: () => number): unknown {
  const name = field.column.name;
  const { mapped } = field;
  switch (mapped.kind) {
    case 'uuid':
      return SAMPLE_UUIDS[uuidIndex() % SAMPLE_UUIDS.length];
    case 'integer':
      return numberSample(name, true);
    case 'number':
      return numberSample(name, false);
    case 'boolean':
      return true;
    case 'date':
      return '2026-01-15';
    case 'datetime':
      return '2026-01-15T10:30:00Z';
    case 'time':
      return '10:30:00';
    case 'json':
      return { source: 'web', tags: ['sample'] };
    case 'enum':
      return mapped.enumValues?.[0] ?? 'value';
    case 'binary':
      return 'SGVsbG8gV29ybGQ=';
    case 'unknown':
      return 'value';
    default:
      return stringSample(name, mapped.maxLength);
  }
}

/** Builds a row that satisfies the generated schema, using realistic values based on column names. */
export function createSampleRow(table: TableModel): Record<string, unknown> {
  let uuidCounter = 0;
  const nextUuid = () => uuidCounter++;
  const row: Record<string, unknown> = {};
  for (const field of table.fields) {
    let value = scalarSample(field, nextUuid);
    if (field.mapped.isArray) {
      for (let i = 0; i < Math.max(1, field.column.arrayDimensions); i++) value = [value];
    }
    row[field.key] = value;
  }
  return row;
}

/** Builds a deliberately broken row to demonstrate validation errors. */
export function createInvalidSampleRow(table: TableModel): Record<string, unknown> {
  const row = createSampleRow(table);
  const required = table.fields.filter((f) => !f.optional && !f.column.primaryKey);
  for (const field of required.slice(0, 2)) delete row[field.key];

  const remaining = table.fields.filter((f) => f.key in row);
  const uuidField = remaining.find((f) => f.mapped.kind === 'uuid' && !f.mapped.isArray);
  if (uuidField) row[uuidField.key] = 'not-a-uuid';
  const numberField = remaining.find((f) => (f.mapped.kind === 'number' || f.mapped.kind === 'integer') && !f.mapped.isArray);
  if (numberField) row[numberField.key] = 'not a number';
  const booleanField = remaining.find((f) => f.mapped.kind === 'boolean');
  if (booleanField) row[booleanField.key] = 'yes';
  return row;
}
