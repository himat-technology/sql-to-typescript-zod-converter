import type { SqlDialect } from '../parser/types';
import { PRESETS, type SqlPreset } from '../presets';
import { cx } from './ui';

interface PresetSelectorProps {
  activePresetId?: string;
  onSelect: (preset: SqlPreset) => void;
}

const DIALECT_COLORS: Record<SqlDialect, { idle: string; active: string; dot: string }> = {
  postgresql: {
    idle: 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100',
    active: 'border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-500/30',
    dot: 'bg-sky-500',
  },
  mysql: {
    idle: 'border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-300 hover:bg-orange-100',
    active: 'border-orange-600 bg-orange-600 text-white shadow-sm shadow-orange-500/30',
    dot: 'bg-orange-500',
  },
  sqlite: {
    idle: 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100',
    active: 'border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-500/30',
    dot: 'bg-teal-500',
  },
  tsql: {
    idle: 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100',
    active: 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-500/30',
    dot: 'bg-rose-500',
  },
};

export function PresetSelector({ activePresetId, onSelect }: PresetSelectorProps) {
  return (
    <div role="group" aria-labelledby="preset-label" className="flex flex-wrap items-center gap-1.5">
      <span id="preset-label" className="mr-1 text-xs font-medium text-slate-600">
        Examples
      </span>
      {PRESETS.map((preset) => {
        const active = preset.id === activePresetId;
        const colors = DIALECT_COLORS[preset.dialect];
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            title={preset.description}
            aria-pressed={active}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active ? colors.active : colors.idle,
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : colors.dot)} aria-hidden="true" />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
