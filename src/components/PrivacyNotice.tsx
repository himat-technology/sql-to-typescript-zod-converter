import { Lock, ServerOff, ShieldCheck, WifiOff } from 'lucide-react';
import { cx } from './ui';

export function PrivacyBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        tone === 'dark' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      <ShieldCheck size={14} aria-hidden="true" />
      100% Browser-Local
    </span>
  );
}

const POINTS = [
  {
    icon: ServerOff,
    chip: 'bg-sky-100 text-sky-700',
    title: 'No server-side conversion',
    body: 'The SQL parser, TypeScript/Zod generator and row validator are bundled into this page and run in your browser tab.',
  },
  {
    icon: WifiOff,
    chip: 'bg-fuchsia-100 text-fuchsia-700',
    title: 'No uploads or analytics',
    body: 'Your schema, generated code and sample rows are never sent anywhere. Open DevTools → Network while you type to verify.',
  },
  {
    icon: Lock,
    chip: 'bg-amber-100 text-amber-700',
    title: 'Nothing persisted',
    body: 'SQL input is kept in memory only. Just your output preferences (casing, syntax, ...) are remembered in local storage.',
  },
];

export function PrivacyNotice() {
  return (
    <section aria-labelledby="privacy-title" className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <div className="h-1 bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-400" aria-hidden="true" />
      <div className="p-5">
        <h2 id="privacy-title" className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          Your SQL stays in your browser
        </h2>
        <p className="mt-2 text-sm text-slate-600">Parsing, conversion and validation happen locally. No SQL schema is uploaded.</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {POINTS.map(({ icon: Icon, chip, title, body }) => (
            <li key={title} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', chip)}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
