import type { FieldCasing } from './casingUtils';

export type OutputMode = 'ts-zod' | 'ts' | 'zod';
export type TsSyntax = 'interface' | 'type';
/**
 * How nullable SQL columns are represented:
 * - `nullable-optional`: `field?: T | null` / `.nullable().optional()`
 * - `nullable`: `field: T | null` / `.nullable()` (key always present, as returned by most drivers)
 * - `optional`: `field?: T` / `.optional()`
 */
export type NullableStyle = 'nullable-optional' | 'nullable' | 'optional';

export interface GeneratorOptions {
  outputMode: OutputMode;
  fieldCasing: FieldCasing;
  tsSyntax: TsSyntax;
  timestampsAsDate: boolean;
  /** Use `z.coerce.date()` instead of `z.date()` so ISO strings (e.g. from JSON) are accepted. */
  coerceDates: boolean;
  nullableStyle: NullableStyle;
  /** Make columns with a DEFAULT, auto-increment or generated value optional (useful for insert payloads). */
  defaultsOptional: boolean;
  singularizeNames: boolean;
  includeComments: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  outputMode: 'ts-zod',
  fieldCasing: 'camel',
  tsSyntax: 'interface',
  timestampsAsDate: false,
  coerceDates: true,
  nullableStyle: 'nullable-optional',
  defaultsOptional: false,
  singularizeNames: true,
  includeComments: true,
};

export const OUTPUT_MODE_OPTIONS: ReadonlyArray<{ id: OutputMode; label: string }> = [
  { id: 'ts-zod', label: 'TypeScript + Zod' },
  { id: 'ts', label: 'TypeScript Only' },
  { id: 'zod', label: 'Zod Only' },
];

export const TS_SYNTAX_OPTIONS: ReadonlyArray<{ id: TsSyntax; label: string }> = [
  { id: 'interface', label: 'interface' },
  { id: 'type', label: 'type' },
];

export const NULLABLE_STYLE_OPTIONS: ReadonlyArray<{ id: NullableStyle; label: string; example: string }> = [
  { id: 'nullable-optional', label: 'Nullable + optional', example: 'bio?: string | null' },
  { id: 'nullable', label: 'Nullable only', example: 'bio: string | null' },
  { id: 'optional', label: 'Optional only', example: 'bio?: string' },
];
