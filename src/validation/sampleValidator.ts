import { z } from 'zod';

export interface IssueItem {
  path: string;
  message: string;
}

export type IssueGroupId = 'missing' | 'type' | 'uuid' | 'format' | 'enum' | 'range' | 'unknown' | 'other';

export interface IssueGroup {
  id: IssueGroupId;
  title: string;
  items: IssueItem[];
}

export type ValidationOutcome =
  | { status: 'empty' }
  | { status: 'invalid-json'; message: string; line?: number; column?: number }
  | { status: 'valid'; data: unknown; rowCount: number }
  | { status: 'invalid'; groups: IssueGroup[]; issueCount: number };

const GROUP_TITLES: Record<IssueGroupId, string> = {
  missing: 'Missing Required Fields',
  type: 'Invalid Type',
  uuid: 'Invalid UUID',
  format: 'Invalid Format',
  enum: 'Invalid Enum Value',
  range: 'Length / Range',
  unknown: 'Unknown Fields',
  other: 'Other Issues',
};

const GROUP_ORDER: IssueGroupId[] = ['missing', 'type', 'uuid', 'format', 'enum', 'range', 'unknown', 'other'];

export function formatPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) return '(row)';
  return path.reduce<string>((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    return acc ? `${acc}.${part}` : String(part);
  }, '');
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 37)}...` : value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return Array.isArray(value) ? 'array' : typeof value;
}

function getAt(data: unknown, path: ReadonlyArray<string | number>): unknown {
  let current = data;
  for (const part of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[part];
  }
  return current;
}

/** Turns Zod issues into user-facing groups ("Missing Required Fields", "Invalid UUID", ...). */
export function groupIssues(issues: z.ZodIssue[], data: unknown): IssueGroup[] {
  const groups = new Map<IssueGroupId, IssueItem[]>();
  const add = (id: IssueGroupId, path: string, message: string) => {
    const items = groups.get(id) ?? [];
    items.push({ path, message });
    groups.set(id, items);
  };

  for (const issue of issues) {
    const path = formatPath(issue.path);
    switch (issue.code) {
      case 'invalid_type':
        if (issue.received === 'undefined') add('missing', path, `${path} is required (${issue.expected})`);
        else add('type', path, `${path} expected ${issue.expected}, received ${issue.received}`);
        break;
      case 'invalid_string':
        if (issue.validation === 'uuid') add('uuid', path, `${path} must be a UUID, received ${describeValue(getAt(data, issue.path))}`);
        else if (issue.validation === 'datetime') add('format', path, `${path} must be an ISO 8601 date-time (e.g. 2026-01-15T10:30:00Z)`);
        else if (issue.validation === 'date') add('format', path, `${path} must be a date in YYYY-MM-DD format`);
        else add('format', path, `${path}: ${issue.message}`);
        break;
      case 'invalid_date':
        add('format', path, `${path} is not a valid date`);
        break;
      case 'invalid_enum_value':
        add('enum', path, `${path} expected one of ${issue.options.map((o) => JSON.stringify(o)).join(' | ')}, received ${describeValue(issue.received)}`);
        break;
      case 'too_big':
      case 'too_small':
        add('range', path, `${path}: ${issue.message}`);
        break;
      case 'unrecognized_keys':
        for (const key of issue.keys) add('unknown', formatPath([...issue.path, key]), `${formatPath([...issue.path, key])} is not a column of this table`);
        break;
      default:
        add('other', path, `${path}: ${issue.message}`);
    }
  }

  return GROUP_ORDER.filter((id) => groups.has(id)).map((id) => ({ id, title: GROUP_TITLES[id], items: groups.get(id)! }));
}

function locateJsonError(text: string, message: string): { line?: number; column?: number } {
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
  const position = /position (\d+)/i.exec(message);
  if (position) {
    const offset = Number(position[1]);
    const before = text.slice(0, offset).split('\n');
    return { line: before.length, column: before[before.length - 1].length + 1 };
  }
  return {};
}

export interface ValidateOptions {
  /** Reject keys that aren't columns of the table. */
  strict: boolean;
}

/**
 * Parses JSON text and validates it with the given (generated) Zod schema. Accepts a single row
 * object or an array of rows.
 */
export function validateSample(schema: z.ZodTypeAny, jsonText: string, options: ValidateOptions = { strict: false }): ValidationOutcome {
  if (!jsonText.trim()) return { status: 'empty' };

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid-json', message, ...locateJsonError(jsonText, message) };
  }

  let rowSchema = schema;
  if (options.strict && schema instanceof z.ZodObject) rowSchema = schema.strict();
  const isArray = Array.isArray(data);
  const finalSchema = isArray ? z.array(rowSchema) : rowSchema;

  const result = finalSchema.safeParse(data);
  if (result.success) {
    return { status: 'valid', data: result.data, rowCount: isArray ? (data as unknown[]).length : 1 };
  }
  return { status: 'invalid', groups: groupIssues(result.error.issues, data), issueCount: result.error.issues.length };
}
