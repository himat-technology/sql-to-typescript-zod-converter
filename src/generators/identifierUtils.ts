import { splitWords } from './casingUtils';

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'implements',
  'interface', 'package', 'private', 'protected', 'public', 'await', 'async', 'arguments', 'eval', 'undefined', 'NaN',
  'Infinity', 'any', 'boolean', 'never', 'number', 'object', 'string', 'symbol', 'unknown', 'bigint', 'type', 'declare',
  'namespace', 'module', 'keyof', 'readonly', 'infer', 'is', 'asserts', 'z',
]);

/** Global names the generated code relies on (or that would confuse readers if shadowed). */
const RESERVED_TYPE_NAMES = new Set([
  'Date', 'Record', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Symbol', 'Function', 'Promise', 'Map', 'Set',
  'Error', 'RegExp', 'JSON', 'Math', 'BigInt', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'Uint8Array', 'Infer', 'Z',
]);

const IRREGULAR_SINGULARS: Record<string, string> = {
  people: 'person',
  men: 'man',
  women: 'woman',
  children: 'child',
  mice: 'mouse',
  geese: 'goose',
  feet: 'foot',
  teeth: 'tooth',
  criteria: 'criterion',
  analyses: 'analysis',
  indices: 'index',
  indexes: 'index',
  matrices: 'matrix',
  vertices: 'vertex',
  statuses: 'status',
  buses: 'bus',
  aliases: 'alias',
  campuses: 'campus',
  viruses: 'virus',
  bonuses: 'bonus',
  censuses: 'census',
  axes: 'axis',
  quizzes: 'quiz',
  movies: 'movie',
  cookies: 'cookie',
  zombies: 'zombie',
  calories: 'calorie',
  rookies: 'rookie',
  pies: 'pie',
  ties: 'tie',
  lies: 'lie',
  knives: 'knife',
  wives: 'wife',
  lives: 'life',
  wolves: 'wolf',
  halves: 'half',
  shelves: 'shelf',
  leaves: 'leaf',
  thieves: 'thief',
  heroes: 'hero',
  potatoes: 'potato',
  tomatoes: 'tomato',
  echoes: 'echo',
};

const UNCOUNTABLE = new Set([
  'data', 'metadata', 'media', 'news', 'series', 'species', 'equipment', 'information', 'feedback', 'analytics', 'sheep',
  'fish', 'deer', 'money', 'rice', 'software', 'hardware', 'staff', 'status', 'access', 'progress', 'sms', 'chassis',
]);

/** Best-effort English singularization of a single lower- or mixed-case word. */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  const restoreCase = (result: string) => {
    if (word === word.toUpperCase() && word.length > 1) return result.toUpperCase();
    if (word[0] === word[0].toUpperCase()) return result.charAt(0).toUpperCase() + result.slice(1);
    return result;
  };

  if (UNCOUNTABLE.has(lower)) return word;
  if (IRREGULAR_SINGULARS[lower]) return restoreCase(IRREGULAR_SINGULARS[lower]);
  if (lower.length <= 3) return word;
  if (/[^aeiouy]ies$/.test(lower) || /quies$/.test(lower)) return restoreCase(lower.slice(0, -3) + 'y');
  if (/(x|ch|ss|sh|zz)es$/.test(lower)) return restoreCase(lower.slice(0, -2));
  if (/s$/.test(lower) && !/(ss|us|is)$/.test(lower)) return restoreCase(lower.slice(0, -1));
  return word;
}

export function isReservedWord(name: string): boolean {
  return RESERVED_WORDS.has(name);
}

/** True when the text can be used as a bare object property key. */
export function isValidPropertyName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/** True when the text can be used as a variable / type identifier. */
export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED_WORDS.has(name);
}

/** Renders an object key, quoting it when it isn't a valid identifier. */
export function formatPropertyKey(name: string): string {
  return isValidPropertyName(name) ? name : JSON.stringify(name);
}

/** Converts arbitrary SQL names (`order-items`, `user accounts`, `2fa_codes`) into a PascalCase type name. */
export function toTypeName(raw: string, singular: boolean): string {
  const words = splitWords(raw).map((w) => w.replace(/[^A-Za-z\d_$]/g, '')).filter(Boolean);
  if (words.length === 0) return 'Table';
  if (singular) words[words.length - 1] = singularize(words[words.length - 1]);
  let name = words.map((w) => (w === w.toUpperCase() && w.length <= 4 && /[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (/^\d/.test(name)) name = `Table${name}`;
  if (RESERVED_TYPE_NAMES.has(name)) name = `${name}Row`;
  return name;
}

/** `User` → `userSchema`, `HTTPLog` → `httpLogSchema`. */
export function toSchemaName(typeName: string): string {
  const leadingCaps = /^[A-Z]+(?=[A-Z][a-z]|\d|$)/.exec(typeName)?.[0];
  const base = leadingCaps ? leadingCaps.toLowerCase() + typeName.slice(leadingCaps.length) : typeName.charAt(0).toLowerCase() + typeName.slice(1);
  return `${base}Schema`;
}

/** Hands out unique names, appending a numeric suffix on collisions. */
export class NameRegistry {
  private readonly used = new Set<string>();

  has(name: string): boolean {
    return this.used.has(name.toLowerCase());
  }

  claim(name: string): string {
    let candidate = name;
    let counter = 2;
    while (this.has(candidate)) candidate = `${name}${counter++}`;
    this.used.add(candidate.toLowerCase());
    return candidate;
  }
}
