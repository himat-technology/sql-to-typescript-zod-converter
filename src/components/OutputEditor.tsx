import { AlertTriangle, Check, Copy, Download, FileCode2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OUTPUT_MODE_OPTIONS, type OutputMode } from '../generators/options';
import { copyToClipboard } from '../utils/clipboard';
import { DEFAULT_EXPORT_FILENAME, downloadTextFile } from '../utils/fileExport';
import { CodeView } from './CodeView';
import { Button, Card } from './ui';

interface OutputEditorProps {
  code: string;
  outputMode: OutputMode;
  stale: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function OutputEditor({ code, outputMode, stale }: OutputEditorProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [exported, setExported] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    setCopyState(ok ? 'copied' : 'failed');
    if (!ok) {
      // Let the user copy manually: select the code text.
      const pre = document.querySelector('#generated-code pre:last-child');
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    later(() => setCopyState('idle'), 2000);
  };

  const handleExport = () => {
    if (downloadTextFile(code, DEFAULT_EXPORT_FILENAME)) {
      setExported(true);
      later(() => setExported(false), 2000);
    }
  };

  const modeLabel = OUTPUT_MODE_OPTIONS.find((o) => o.id === outputMode)?.label;
  const empty = code.length === 0;

  return (
    <Card
      id="output"
      accent="emerald"
      title={
        <>
          TypeScript &amp; Zod Output
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{modeLabel}</span>
        </>
      }
      icon={<FileCode2 size={16} />}
      bodyClassName="p-0"
      actions={
        <>
          <Button
            onClick={handleCopy}
            disabled={empty}
            icon={copyState === 'copied' ? <Check size={14} /> : copyState === 'failed' ? <AlertTriangle size={14} /> : <Copy size={14} />}
            aria-label={copyState === 'copied' ? 'Copied to clipboard' : 'Copy generated code to clipboard'}
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Press Ctrl+C' : 'Copy Code'}
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={empty} icon={exported ? <Check size={14} /> : <Download size={14} />} aria-label={`Export as ${DEFAULT_EXPORT_FILENAME}`}>
            {exported ? 'Downloaded' : 'Export .ts'}
          </Button>
        </>
      }
    >
      <span className="sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Code copied to clipboard' : copyState === 'failed' ? 'Copy failed. The code is selected; press Control C to copy.' : ''}
      </span>
      {stale && (
        <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} aria-hidden="true" />
          Showing output from the last valid SQL — fix the parse errors to refresh.
        </p>
      )}
      {empty ? (
        <div className="flex h-[420px] items-center justify-center bg-code-bg px-6 text-center font-mono text-sm text-code-muted sm:h-[560px]">
          Generated TypeScript will appear here once CREATE TABLE statements are detected.
        </div>
      ) : (
        <CodeView id="generated-code" code={code} label="Generated TypeScript code" className="h-[420px] sm:h-[560px]" />
      )}
    </Card>
  );
}
