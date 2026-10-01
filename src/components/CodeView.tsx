import { useMemo } from 'react';
import { highlightTs } from '../utils/highlight';
import { CodeTokens } from './CodeTokens';

interface CodeViewProps {
  code: string;
  label: string;
  className?: string;
  id?: string;
}

/** Read-only, highlighted, horizontally scrollable code block with line numbers. */
export function CodeView({ code, label, className, id }: CodeViewProps) {
  const tokens = useMemo(() => highlightTs(code), [code]);
  const lineNumbers = useMemo(() => {
    const count = code.endsWith('\n') ? code.split('\n').length - 1 : code.split('\n').length;
    return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1).join('\n');
  }, [code]);

  return (
    <div
      id={id}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`code-scroll flex overflow-auto bg-code-bg font-mono text-[13px] leading-5 ${className ?? ''}`}
    >
      <pre aria-hidden="true" className="sticky left-0 m-0 min-h-full shrink-0 border-r border-code-border bg-code-gutter py-3 pr-2 pl-3 text-right text-code-muted select-none">
        {lineNumbers}
      </pre>
      <pre className="m-0 flex-1 px-4 py-3 whitespace-pre">
        <code>
          <CodeTokens tokens={tokens} />
        </code>
      </pre>
    </div>
  );
}
