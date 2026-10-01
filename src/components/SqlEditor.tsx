import { Database, Loader2, Trash2 } from 'lucide-react';
import { useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from 'react';
import { highlightSql } from '../utils/highlight';
import { CodeTokens } from './CodeTokens';
import { Button, Card, cx } from './ui';

/** Above this size the editor drops syntax highlighting to stay responsive. */
const HIGHLIGHT_LIMIT = 60_000;

export interface SqlEditorHandle {
  focusAt: (line: number, column: number) => void;
}

export type ParseStatus = 'idle' | 'parsing' | 'ok' | 'warning' | 'error';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  status: ParseStatus;
  tableCount: number;
  toolbar: ReactNode;
  ref?: Ref<SqlEditorHandle>;
}

const STATUS_TEXT: Record<ParseStatus, string> = {
  idle: 'Waiting for SQL',
  parsing: 'Parsing…',
  ok: 'Parsed',
  warning: 'Parsed with warnings',
  error: 'Parse errors',
};

const STATUS_DOT: Record<ParseStatus, string> = {
  idle: 'bg-slate-400',
  parsing: 'bg-sky-500',
  ok: 'bg-emerald-600',
  warning: 'bg-amber-500',
  error: 'bg-rose-600',
};

export function SqlEditor({ value, onChange, onClear, status, tableCount, toolbar, ref }: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const highlight = value.length <= HIGHLIGHT_LIMIT;
  const tokens = useMemo(() => (highlight ? highlightSql(value) : []), [value, highlight]);
  const lineCount = useMemo(() => {
    let count = 1;
    for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) count++;
    return count;
  }, [value]);
  const gutterText = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);

  const syncScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (preRef.current) {
      preRef.current.scrollTop = textarea.scrollTop;
      preRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop;
  };

  useImperativeHandle(ref, () => ({
    focusAt(line: number, column: number) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const lines = textarea.value.split('\n');
      const lineIndex = Math.min(Math.max(line, 1), lines.length) - 1;
      let offset = 0;
      for (let i = 0; i < lineIndex; i++) offset += lines[i].length + 1;
      offset += Math.min(Math.max(column - 1, 0), lines[lineIndex].length);
      textarea.focus();
      textarea.setSelectionRange(offset, Math.min(offset + 1, textarea.value.length));
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight / 3);
      syncScroll();
    },
  }));

  return (
    <Card
      id="sql-input"
      accent="sky"
      title="SQL CREATE TABLE DDL Input"
      icon={<Database size={16} />}
      actions={
        <Button variant="danger" icon={<Trash2 size={14} />} onClick={onClear} disabled={!value} aria-label="Clear SQL input">
          Clear
        </Button>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3">{toolbar}</div>

      <div className="relative h-[420px] overflow-hidden bg-code-bg font-mono text-[13px] leading-5 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-sky-500 sm:h-[480px]">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-0 w-11 overflow-hidden border-r border-code-border bg-code-gutter py-3 pr-2 text-right text-code-muted select-none"
        >
          <pre className="m-0 pb-10 font-mono">{gutterText}</pre>
        </div>

        {highlight && (
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 left-11 m-0 overflow-hidden px-3 py-3 pr-10 pb-10 whitespace-pre"
          >
            <CodeTokens tokens={tokens} />
            {'\n'}
          </pre>
        )}

        <label htmlFor="sql-textarea" className="sr-only">
          SQL CREATE TABLE statements
        </label>
        <textarea
          id="sql-textarea"
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={'-- Paste your CREATE TABLE statements here\nCREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);'}
          aria-describedby="sql-status"
          className={cx(
            'code-scroll absolute inset-0 left-11 m-0 h-full w-[calc(100%-2.75rem)] resize-none overflow-auto border-0 bg-transparent px-3 py-3 whitespace-pre caret-white outline-none selection:bg-sky-400/30 placeholder:text-code-muted focus-visible:outline-none',
            highlight ? 'text-transparent' : 'text-code-text',
          )}
        />
      </div>

      <div
        id="sql-status"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs text-slate-600"
        aria-live="polite"
      >
        <span className="flex items-center gap-2">
          {status === 'parsing' ? (
            <Loader2 size={12} className="animate-spin text-sky-600" aria-hidden="true" />
          ) : (
            <span className={cx('h-2 w-2 rounded-full', STATUS_DOT[status])} aria-hidden="true" />
          )}
          <span className="font-medium text-slate-700">{STATUS_TEXT[status]}</span>
          {status !== 'idle' && status !== 'parsing' && (
            <span>
              · {tableCount} {tableCount === 1 ? 'table' : 'tables'} detected
            </span>
          )}
        </span>
        <span className="tabular-nums">
          {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'} · {value.length.toLocaleString()} chars
          {!highlight && ' · highlighting off for large input'}
        </span>
      </div>
    </Card>
  );
}
