import { DIALECT_OPTIONS } from '../parser/dialects';
import type { SqlDialect } from '../parser/types';

interface DialectSelectorProps {
  value: SqlDialect;
  onChange: (dialect: SqlDialect) => void;
}

export function DialectSelector({ value, onChange }: DialectSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="dialect-select" className="text-xs font-medium text-slate-600">
        Dialect
      </label>
      <select
        id="dialect-select"
        value={value}
        onChange={(event) => onChange(event.target.value as SqlDialect)}
        className="h-8 rounded-md border border-slate-300 bg-white pr-8 pl-2.5 text-xs font-medium text-slate-800 hover:border-slate-400"
      >
        {DIALECT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
