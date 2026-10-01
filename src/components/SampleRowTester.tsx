import { AlignLeft, CircleCheck, CircleX, FlaskConical, Play, Shuffle, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TableModel } from '../generators/model';
import type { GeneratorOptions } from '../generators/options';
import { createInvalidSampleRow, createSampleRow } from '../validation/sampleRowFactory';
import { validateSample, type ValidationOutcome } from '../validation/sampleValidator';
import type { RuntimeSchemas } from '../validation/schemaBuilder';
import { Button, Card, cx } from './ui';

interface SampleRowTesterProps {
  tables: TableModel[];
  runtime: RuntimeSchemas;
  options: GeneratorOptions;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

function tableSignature(table: TableModel | undefined): string {
  if (!table) return '';
  return `${table.typeName}|${table.fields.map((f) => `${f.key}:${f.mapped.kind}:${f.optional}:${f.nullable}`).join(',')}`;
}

export function SampleRowTester({ tables, runtime, options, selectedIndex, onSelectIndex }: SampleRowTesterProps) {
  const index = Math.min(selectedIndex, Math.max(tables.length - 1, 0));
  const table = tables[index];
  const runtimeTable = runtime.tables[index];

  const [json, setJson] = useState('');
  const [autoFilled, setAutoFilled] = useState(true);
  const [strict, setStrict] = useState(false);
  const [validatedText, setValidatedText] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  // Keep the auto-generated sample in sync with the selected table and output options.
  const signature = tableSignature(table);
  useEffect(() => {
    if (!table || !autoFilled) return;
    const sample = pretty(createSampleRow(table));
    setJson(sample);
    setValidatedText(sample);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-run when the table shape changes

  useEffect(() => {
    const id = window.setTimeout(() => setValidatedText(json), 300);
    return () => window.clearTimeout(id);
  }, [json]);

  const outcome: ValidationOutcome = useMemo(() => {
    if (!runtimeTable) return { status: 'empty' };
    return validateSample(runtimeTable.schema, validatedText, { strict });
  }, [runtimeTable, validatedText, strict]);

  const setGenerated = (text: string) => {
    setJson(text);
    setValidatedText(text);
  };

  const handleValidateNow = () => {
    setValidatedText(json);
    resultRef.current?.focus();
  };

  const handleFormat = () => {
    try {
      setGenerated(pretty(JSON.parse(json)));
    } catch {
      setValidatedText(json);
    }
  };

  const disabled = !table || !runtimeTable;
  const dateWarning = options.timestampsAsDate && !options.coerceDates && table?.fields.some((f) => f.mapped.kind === 'date' || f.mapped.kind === 'datetime');

  return (
    <Card id="row-tester" accent="amber" title="Interactive Sample Database Row Tester" icon={<FlaskConical size={16} />}>
      {tables.length === 0 ? (
        <p className="text-sm text-slate-500">Generate at least one table schema to test sample rows.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="tester-table" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Table / schema
                </label>
                <select
                  id="tester-table"
                  value={index}
                  onChange={(event) => onSelectIndex(Number(event.target.value))}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800"
                >
                  {tables.map((t, i) => (
                    <option key={`${t.schemaName}-${i}`} value={i}>
                      {t.table.schema ? `${t.table.schema}.` : ''}
                      {t.table.name} → {t.schemaName}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex h-9 items-center gap-2 text-xs font-medium text-slate-700">
                <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                Reject unknown keys (<code className="font-mono">.strict()</code>)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                icon={<Sparkles size={14} />}
                disabled={disabled}
                onClick={() => {
                  setAutoFilled(true);
                  setGenerated(pretty(createSampleRow(table)));
                }}
              >
                Insert valid sample
              </Button>
              <Button
                icon={<Shuffle size={14} />}
                disabled={disabled}
                onClick={() => {
                  setAutoFilled(false);
                  setGenerated(pretty(createInvalidSampleRow(table)));
                }}
              >
                Insert invalid sample
              </Button>
              <Button icon={<AlignLeft size={14} />} disabled={!json.trim()} onClick={handleFormat}>
                Format JSON
              </Button>
            </div>

            <div>
              <label htmlFor="tester-json" className="mb-1.5 block text-xs font-medium text-slate-600">
                Sample row JSON <span className="font-normal text-slate-500">(an object, or an array of rows)</span>
              </label>
              <textarea
                id="tester-json"
                value={json}
                onChange={(event) => {
                  setJson(event.target.value);
                  setAutoFilled(false);
                }}
                spellCheck={false}
                wrap="off"
                rows={14}
                aria-describedby="tester-hint"
                className="code-scroll block h-72 w-full resize-y rounded-md border border-code-border bg-code-bg px-3 py-2.5 font-mono text-[13px] leading-5 text-code-text caret-white outline-none placeholder:text-code-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-500"
                placeholder='{ "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }'
              />
              <p id="tester-hint" className="mt-1.5 text-xs text-slate-600">
                Keys must match the selected field casing ({table ? <code className="font-mono">{table.fields[0]?.key ?? '—'}</code> : '—'}). Validation runs
                automatically as you type.
              </p>
            </div>

            <div>
              <Button variant="primary" size="md" icon={<Play size={14} />} disabled={disabled} onClick={handleValidateNow}>
                Validate Row
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {options.outputMode === 'ts' && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                TypeScript-only output is selected. Rows are validated with the Zod schema that the same settings would generate.
              </p>
            )}
            {dateWarning && (
              <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  <code className="font-mono">z.date()</code> only accepts Date objects, so ISO strings from JSON will fail. Enable “Coerce date strings” to test with JSON.
                </span>
              </p>
            )}
            {runtime.error && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                Could not build the runtime schema: {runtime.error}
              </p>
            )}

            <div ref={resultRef} tabIndex={-1} aria-live="polite" aria-atomic="true" className="min-w-0 outline-none">
              <ValidationResult outcome={outcome} schemaName={runtimeTable?.schemaName ?? ''} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ValidationResult({ outcome, schemaName }: { outcome: ValidationOutcome; schemaName: string }) {
  switch (outcome.status) {
    case 'empty':
      return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Paste a JSON row to validate it against {schemaName || 'the schema'}.</p>;

    case 'invalid-json':
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <CircleX size={16} aria-hidden="true" />
            Invalid JSON
          </p>
          <p className="mt-1 text-sm text-rose-800">
            {outcome.message}
            {outcome.line !== undefined && ` (line ${outcome.line}, column ${outcome.column})`}
          </p>
          <p className="mt-1 text-xs text-rose-700">Check for missing quotes around keys, trailing commas or unbalanced braces.</p>
        </div>
      );

    case 'valid':
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CircleCheck size={16} aria-hidden="true" />
            <span>
              Valid — {outcome.rowCount === 1 ? 'row matches' : `all ${outcome.rowCount} rows match`} <code className="font-mono">{schemaName}</code>
            </span>
          </p>
          <p className="mt-1 text-xs text-emerald-800">Parsed output returned by Zod (dates shown as ISO strings):</p>
          <pre className="code-scroll mt-2 max-h-80 overflow-auto rounded-md bg-code-bg p-3 font-mono text-xs leading-5 text-code-text">{JSON.stringify(outcome.data, null, 2)}</pre>
        </div>
      );

    case 'invalid':
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <CircleX size={16} aria-hidden="true" />
            Validation failed — {outcome.issueCount} {outcome.issueCount === 1 ? 'issue' : 'issues'}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {outcome.groups.map((group) => (
              <div key={group.id}>
                <h3 className="text-xs font-semibold tracking-wide text-rose-900 uppercase">{group.title}:</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {group.items.map((item, i) => (
                    <li key={i} className={cx('flex gap-2 text-sm text-rose-900')}>
                      <span aria-hidden="true">•</span>
                      <span className="min-w-0 break-words">
                        <code className="rounded bg-white/70 px-1 font-mono text-[0.92em]">{item.path}</code>{' '}
                        {item.message.startsWith(item.path) ? item.message.slice(item.path.length).replace(/^:\s*/, '— ') : `— ${item.message}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
  }
}
