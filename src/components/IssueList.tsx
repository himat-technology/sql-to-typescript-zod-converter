import { AlertTriangle, CircleAlert, Info, Lightbulb } from 'lucide-react';
import type { ParseIssue } from '../parser/types';
import { cx, InlineCode } from './ui';

interface IssueListProps {
  issues: ParseIssue[];
  stale: boolean;
  onJumpTo: (line: number, column: number) => void;
  dialectHint?: { label: string; onSwitch: () => void };
}

const STYLES = {
  error: { icon: CircleAlert, label: 'Error', text: 'text-rose-800', iconColor: 'text-rose-600' },
  warning: { icon: AlertTriangle, label: 'Warning', text: 'text-amber-900', iconColor: 'text-amber-600' },
  info: { icon: Info, label: 'Info', text: 'text-slate-700', iconColor: 'text-sky-600' },
} as const;

export function IssueList({ issues, stale, onJumpTo, dialectHint }: IssueListProps) {
  const errors = issues.filter((i) => i.severity === 'error');
  if (issues.length === 0 && !dialectHint) return null;

  return (
    <section
      aria-labelledby="issues-title"
      className={cx(
        'overflow-hidden rounded-xl border bg-white shadow-sm',
        errors.length > 0 ? 'border-rose-200' : 'border-slate-200',
      )}
    >
      <header className={cx('flex items-center justify-between gap-2 border-b px-4 py-3', errors.length > 0 ? 'border-rose-100 bg-rose-50/60' : 'border-slate-200')}>
        <h2 id="issues-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {errors.length > 0 ? (
            <>
              <CircleAlert size={16} className="text-rose-600" aria-hidden="true" />
              Unable to parse SQL
            </>
          ) : (
            <>
              <Info size={16} className="text-slate-500" aria-hidden="true" />
              Parser notes
            </>
          )}
        </h2>
        <span className="text-xs text-slate-600">
          {errors.length} {errors.length === 1 ? 'error' : 'errors'} · {issues.length - errors.length} {issues.length - errors.length === 1 ? 'note' : 'notes'}
        </span>
      </header>

      {stale && errors.length > 0 && (
        <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
          The generated output below is from the last SQL that parsed successfully. Fix the errors to update it.
        </p>
      )}

      {dialectHint && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-sky-50/60 px-4 py-2 text-xs text-slate-700">
          <span className="flex items-center gap-1.5">
            <Lightbulb size={14} className="text-sky-700" aria-hidden="true" />
            <span>
              This SQL looks like <strong className="font-semibold">{dialectHint.label}</strong>.
            </span>
          </span>
          <button type="button" onClick={dialectHint.onSwitch} className="font-medium text-sky-800 underline-offset-2 hover:underline">
            Switch dialect to {dialectHint.label}
          </button>
        </div>
      )}

      <ul className="code-scroll max-h-72 divide-y divide-slate-100 overflow-y-auto" aria-live="polite">
        {issues.map((issue, index) => {
          const style = STYLES[issue.severity];
          const Icon = style.icon;
          return (
            <li key={index} className="flex gap-2.5 px-4 py-2.5 text-sm">
              <Icon size={15} className={cx('mt-0.5 shrink-0', style.iconColor)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={cx('break-words', style.text)}>
                  <span className="mr-1.5 text-xs font-semibold tracking-wide uppercase">{style.label}:</span>
                  <InlineCode text={issue.message} />
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-600">
                  {issue.line !== undefined && (
                    <button
                      type="button"
                      className="font-mono text-sky-800 underline-offset-2 hover:underline"
                      onClick={() => onJumpTo(issue.line!, issue.column ?? 1)}
                      aria-label={`Go to line ${issue.line}, column ${issue.column ?? 1} in the SQL editor`}
                    >
                      Line {issue.line}, col {issue.column ?? 1}
                    </button>
                  )}
                  {issue.suggestion && (
                    <span>
                      <span className="font-medium">Suggestion:</span> <InlineCode text={issue.suggestion} />
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
