export type FieldCasing = 'camel' | 'snake' | 'pascal';

export const FIELD_CASING_OPTIONS: ReadonlyArray<{ id: FieldCasing; label: string; example: string }> = [
  { id: 'camel', label: 'camelCase', example: 'fullName' },
  { id: 'snake', label: 'snake_case', example: 'full_name' },
  { id: 'pascal', label: 'PascalCase', example: 'FullName' },
];

/**
 * Splits an identifier into words, understanding snake_case, kebab-case, spaces, camelCase and
 * acronyms (`userID` → `user`, `ID`; `HTTPServer` → `HTTP`, `Server`).
 */
export function splitWords(input: string): string[] {
  return input
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z\d\u00C0-\uFFFF]+/)
    .filter(Boolean);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function leadingUnderscores(input: string): string {
  return /^_+/.exec(input)?.[0] ?? '';
}

export function toCamelCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return input;
  return leadingUnderscores(input) + words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w))).join('');
}

export function toPascalCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return input;
  return leadingUnderscores(input) + words.map(capitalize).join('');
}

export function toSnakeCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return input;
  return leadingUnderscores(input) + words.map((w) => w.toLowerCase()).join('_');
}

export function applyCasing(input: string, casing: FieldCasing): string {
  switch (casing) {
    case 'camel':
      return toCamelCase(input);
    case 'snake':
      return toSnakeCase(input);
    case 'pascal':
      return toPascalCase(input);
  }
}
