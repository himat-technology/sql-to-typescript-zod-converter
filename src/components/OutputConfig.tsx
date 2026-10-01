import { Settings2 } from 'lucide-react';
import { FIELD_CASING_OPTIONS } from '../generators/casingUtils';
import {
  NULLABLE_STYLE_OPTIONS,
  OUTPUT_MODE_OPTIONS,
  TS_SYNTAX_OPTIONS,
  type GeneratorOptions,
} from '../generators/options';
import { Card, SegmentedControl } from './ui';

interface OutputConfigProps {
  options: GeneratorOptions;
  onChange: (options: GeneratorOptions) => void;
}

function Checkbox({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-violet-600 disabled:opacity-50"
      />
      <div className={disabled ? 'opacity-60' : undefined}>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-slate-600">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function OutputConfig({ options, onChange }: OutputConfigProps) {
  const set = <K extends keyof GeneratorOptions>(key: K, value: GeneratorOptions[K]) => onChange({ ...options, [key]: value });

  return (
    <Card id="output-config" accent="violet" title="Output Configuration" icon={<Settings2 size={16} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SegmentedControl name="output-mode" label="Output mode" value={options.outputMode} options={OUTPUT_MODE_OPTIONS} onChange={(v) => set('outputMode', v)} />
        </div>
        <SegmentedControl
          name="field-casing"
          label="Field casing"
          value={options.fieldCasing}
          mono
          options={FIELD_CASING_OPTIONS.map((o) => ({ ...o, hint: `full_name → ${o.example}` }))}
          onChange={(v) => set('fieldCasing', v)}
        />
        <SegmentedControl name="ts-syntax" label="TypeScript syntax" value={options.tsSyntax} mono options={TS_SYNTAX_OPTIONS} onChange={(v) => set('tsSyntax', v)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Checkbox
          id="opt-timestamps"
          label="Map Timestamp to Date"
          description="TIMESTAMP, TIMESTAMPTZ, DATETIME and DATE become Date instead of ISO strings."
          checked={options.timestampsAsDate}
          onChange={(v) => set('timestampsAsDate', v)}
        />
        <Checkbox
          id="opt-coerce"
          label="Coerce date strings"
          description="Use z.coerce.date() so ISO strings (e.g. JSON) parse into Date. Off emits z.date()."
          checked={options.coerceDates}
          disabled={!options.timestampsAsDate}
          onChange={(v) => set('coerceDates', v)}
        />
      </div>

      <details className="group mt-4 rounded-md border border-slate-200">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
            ›
          </span>{' '}
          Advanced options
        </summary>
        <div className="grid gap-4 border-t border-slate-200 p-3">
          <div>
            <label htmlFor="opt-nullable" className="mb-1.5 block text-xs font-medium text-slate-600">
              Nullable columns are represented as
            </label>
            <select
              id="opt-nullable"
              value={options.nullableStyle}
              onChange={(event) => set('nullableStyle', event.target.value as GeneratorOptions['nullableStyle'])}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800"
            >
              {NULLABLE_STYLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.example}
                </option>
              ))}
            </select>
          </div>
          <Checkbox
            id="opt-defaults"
            label="Columns with defaults are optional"
            description="DEFAULT, auto-increment and generated columns get ? / .optional() — handy for insert payloads."
            checked={options.defaultsOptional}
            onChange={(v) => set('defaultsOptional', v)}
          />
          <Checkbox
            id="opt-singular"
            label="Singularize type names"
            description="users → User / userSchema. Off keeps Users / usersSchema."
            checked={options.singularizeNames}
            onChange={(v) => set('singularizeNames', v)}
          />
          <Checkbox
            id="opt-comments"
            label="Include JSDoc comments"
            description="SQL type, keys, defaults and column comments above each field."
            checked={options.includeComments}
            onChange={(v) => set('includeComments', v)}
          />
        </div>
      </details>
    </Card>
  );
}
