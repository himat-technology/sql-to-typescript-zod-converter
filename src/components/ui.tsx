import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

interface CardProps {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  headingLevel?: 'h2' | 'h3';
  accent?: Accent;
}

export type Accent = 'sky' | 'violet' | 'emerald' | 'amber' | 'indigo' | 'rose';

const ACCENTS: Record<Accent, { bar: string; chip: string }> = {
  sky: { bar: 'from-sky-500 via-cyan-400 to-teal-400', chip: 'bg-sky-100 text-sky-700' },
  violet: { bar: 'from-violet-500 via-purple-500 to-fuchsia-500', chip: 'bg-violet-100 text-violet-700' },
  emerald: { bar: 'from-emerald-500 via-teal-400 to-cyan-400', chip: 'bg-emerald-100 text-emerald-700' },
  amber: { bar: 'from-amber-400 via-orange-400 to-rose-400', chip: 'bg-amber-100 text-amber-700' },
  indigo: { bar: 'from-indigo-500 via-blue-500 to-sky-400', chip: 'bg-indigo-100 text-indigo-700' },
  rose: { bar: 'from-rose-500 via-pink-500 to-fuchsia-500', chip: 'bg-rose-100 text-rose-700' },
};

export function Card({ title, icon, actions, children, className, bodyClassName, id, headingLevel = 'h2', accent = 'indigo' }: CardProps) {
  const Heading = headingLevel;
  const headingId = id ? `${id}-title` : undefined;
  const colors = ACCENTS[accent];
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cx('min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-indigo-900/5', className)}
    >
      <div className={cx('h-1 bg-linear-to-r', colors.bar)} aria-hidden="true" />
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && (
            <Heading id={headingId} className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
              {icon && (
                <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', colors.chip)} aria-hidden="true">
                  {icon}
                </span>
              )}
              {title}
            </Heading>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-violet-500/30 hover:from-indigo-500 hover:to-violet-500',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  danger: 'bg-white text-rose-700 hover:bg-rose-50 border-rose-200',
};

export function Button({ variant = 'secondary', size = 'sm', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  name: string;
  /** Render option labels in the monospace font (for code-like values). */
  mono?: boolean;
}

/** Radio group styled as a segmented control (fully keyboard accessible via native radios). */
export function SegmentedControl<T extends string>({ label, value, options, onChange, name, mono }: SegmentedControlProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-slate-600">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-indigo-100 bg-indigo-50/60 p-1">
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              title={option.hint}
              className={cx(
                'relative flex min-w-0 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-sky-600',
                checked
                  ? 'bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-violet-500/30'
                  : 'text-slate-600 hover:bg-white/80 hover:text-indigo-700',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
              />
              <span className={cx(mono && 'font-mono')}>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Renders text with `backtick` spans as inline code. */
export function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code key={index} className="rounded bg-slate-900/5 px-1 py-px font-mono text-[0.92em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
