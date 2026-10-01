import { useCallback, useMemo, useRef, useState } from 'react';
import { DetectedTables } from './components/DetectedTables';
import { DialectSelector } from './components/DialectSelector';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { IssueList } from './components/IssueList';
import { OutputConfig } from './components/OutputConfig';
import { OutputEditor } from './components/OutputEditor';
import { PresetSelector } from './components/PresetSelector';
import { PrivacyNotice } from './components/PrivacyNotice';
import { SampleRowTester } from './components/SampleRowTester';
import { SqlEditor, type ParseStatus, type SqlEditorHandle } from './components/SqlEditor';
import { generateCode } from './generators/codeGenerator';
import { DEFAULT_GENERATOR_OPTIONS, type GeneratorOptions } from './generators/options';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { usePersistentState } from './hooks/usePersistentState';
import { detectDialect } from './parser/dialectDetection';
import { getDialect } from './parser/dialects';
import { parseSql } from './parser/sqlParser';
import type { DatabaseSchema, SqlDialect } from './parser/types';
import { PRESETS, type SqlPreset } from './presets';
import { buildRuntimeSchemas } from './validation/schemaBuilder';

const INITIAL_PRESET = PRESETS[0];
const PARSE_DEBOUNCE_MS = 250;

interface ValidSnapshot {
  schema: DatabaseSchema;
  dialect: SqlDialect;
}

export default function App() {
  const [sql, setSql] = useState(INITIAL_PRESET.sql);
  const [dialect, setDialect] = useState<SqlDialect>(INITIAL_PRESET.dialect);
  const [activePresetId, setActivePresetId] = useState<string | undefined>(INITIAL_PRESET.id);
  const [options, setOptions] = usePersistentState<GeneratorOptions>('himat-sql-ts-zod:options', DEFAULT_GENERATOR_OPTIONS);
  const [testerIndex, setTesterIndex] = useState(0);
  const editorRef = useRef<SqlEditorHandle>(null);

  const debouncedSql = useDebouncedValue(sql, PARSE_DEBOUNCE_MS);
  const isPending = debouncedSql !== sql;

  const parseResult = useMemo(() => parseSql(debouncedSql, dialect), [debouncedSql, dialect]);

  // Keep the last successfully parsed schema so a typo doesn't blank the output.
  const lastValid = useRef<ValidSnapshot | null>(null);
  const hasTables = parseResult.schema.tables.length > 0;
  if (hasTables) lastValid.current = { schema: parseResult.schema, dialect };
  if (!debouncedSql.trim()) lastValid.current = null;
  const stale = !hasTables && lastValid.current !== null;
  const display = hasTables || !lastValid.current ? { schema: parseResult.schema, dialect } : lastValid.current;

  const generated = useMemo(() => generateCode(display.schema, display.dialect, options), [display.schema, display.dialect, options]);
  const runtime = useMemo(() => buildRuntimeSchemas(generated.model), [generated.model]);

  const issues = useMemo(
    () => [...parseResult.issues, ...(stale ? [] : generated.model.warnings)],
    [parseResult.issues, generated.model.warnings, stale],
  );

  const errorCount = parseResult.issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const status: ParseStatus = !sql.trim()
    ? 'idle'
    : isPending
      ? 'parsing'
      : errorCount > 0
        ? 'error'
        : warningCount > 0
          ? 'warning'
          : 'ok';

  const guess = useMemo(() => detectDialect(debouncedSql), [debouncedSql]);
  const dialectHint =
    guess && guess.dialect !== dialect
      ? { label: getDialect(guess.dialect).label, onSwitch: () => setDialect(guess.dialect) }
      : undefined;

  const handleSqlChange = useCallback((value: string) => {
    setSql(value);
    setActivePresetId(undefined);
  }, []);

  const handlePreset = (preset: SqlPreset) => {
    setSql(preset.sql);
    setDialect(preset.dialect);
    setActivePresetId(preset.id);
    setTesterIndex(0);
  };

  const handleClear = () => {
    setSql('');
    setActivePresetId(undefined);
    setTesterIndex(0);
  };

  const handleTestTable = (index: number) => {
    setTesterIndex(index);
    document.getElementById('row-tester')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('tester-json')?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/80 via-slate-50 to-fuchsia-50/60">
      <a
        href="#sql-textarea"
        className="sr-only z-50 rounded bg-slate-900 px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to SQL editor
      </a>
      <Header />

      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            <SqlEditor
              ref={editorRef}
              value={sql}
              onChange={handleSqlChange}
              onClear={handleClear}
              status={status}
              tableCount={parseResult.schema.tables.length}
              toolbar={
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DialectSelector value={dialect} onChange={setDialect} />
                    <span className="text-xs text-slate-500">Live conversion · runs locally</span>
                  </div>
                  <PresetSelector activePresetId={activePresetId} onSelect={handlePreset} />
                </>
              }
            />
            <IssueList
              issues={isPending ? [] : issues}
              stale={stale}
              dialectHint={isPending ? undefined : dialectHint}
              onJumpTo={(line, column) => editorRef.current?.focusAt(line, column)}
            />
            <DetectedTables tables={generated.model.tables} stale={stale} onTestTable={handleTestTable} />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <OutputConfig options={options} onChange={setOptions} />
            <OutputEditor code={generated.code} outputMode={options.outputMode} stale={stale} />
          </div>
        </div>

        <SampleRowTester tables={generated.model.tables} runtime={runtime} options={options} selectedIndex={testerIndex} onSelectIndex={setTesterIndex} />

        <PrivacyNotice />
      </main>

      <Footer />
    </div>
  );
}
