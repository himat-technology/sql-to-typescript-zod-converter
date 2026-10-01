import { ExternalLink, Globe, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useId } from 'react';
import { COMPANY } from '../config/company';
import { PrivacyBadge } from './PrivacyNotice';

export function HiMatLogo({ size = 28 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#818cf8" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path d="M9.5 8v16M22.5 8v16M9.5 16h13" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

const DIALECT_PILLS = [
  { label: 'PostgreSQL', className: 'border-sky-300/40 bg-sky-400/15 text-sky-100' },
  { label: 'MySQL', className: 'border-orange-300/40 bg-orange-400/15 text-orange-100' },
  { label: 'SQLite', className: 'border-teal-300/40 bg-teal-400/15 text-teal-100' },
  { label: 'T-SQL', className: 'border-rose-300/40 bg-rose-400/15 text-rose-100' },
];

const HIGHLIGHTS = [
  { icon: Zap, label: 'Live conversion', className: 'text-amber-300' },
  { icon: Sparkles, label: 'Real Zod validation', className: 'text-fuchsia-300' },
  { icon: ShieldCheck, label: 'No uploads, ever', className: 'text-emerald-300' },
];

export function Header() {
  return (
    <header className="relative overflow-hidden bg-linear-to-br from-indigo-950 via-violet-900 to-fuchsia-900 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute top-10 left-1/2 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap text-white">
            <HiMatLogo />
            {COMPANY.name}
          </a>
          <span className="hidden text-white/40 sm:inline" aria-hidden="true">/</span>
          <span className="hidden truncate text-white/75 sm:inline">Free Tools</span>
          <span className="hidden text-white/40 md:inline" aria-hidden="true">/</span>
          <span className="hidden truncate text-white/75 md:inline" aria-current="page">
            SQL to TypeScript &amp; Zod
          </span>
        </nav>
        <div className="flex items-center gap-3">
          <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white lg:inline-flex">
            <Globe size={14} aria-hidden="true" />
            {COMPANY.websiteLabel}
          </a>
          <a href={`mailto:${COMPANY.email}`} className="hidden items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white lg:inline-flex">
            <Mail size={14} aria-hidden="true" />
            {COMPANY.email}
          </a>
          <PrivacyBadge tone="dark" />
        </div>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 pt-8 pb-10 sm:px-6 sm:pt-10 sm:pb-12">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
          <Sparkles size={13} className="text-amber-300" aria-hidden="true" />
          Free developer tool by {COMPANY.name}
        </p>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          SQL DDL to{' '}
          <span className="bg-linear-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">TypeScript &amp; Zod</span>{' '}
          Schema Generator
        </h1>
        <p className="mt-3 max-w-2xl text-base text-indigo-100 sm:text-lg">Convert SQL CREATE TABLE statements into TypeScript and Zod schemas.</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {DIALECT_PILLS.map((pill) => (
            <span key={pill.label} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${pill.className}`}>
              {pill.label}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
            {HIGHLIGHTS.map(({ icon: Icon, label, className }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon size={15} className={className} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <a
            href={COMPANY.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 focus-visible:outline-white"
          >
            Live demo on himat.tech
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        <p className="mt-6 flex items-start gap-2 text-sm text-indigo-100">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-white">Your SQL stays in your browser.</strong> Parsing, conversion and validation happen locally. No
            SQL schema is uploaded.
          </span>
        </p>
      </div>
    </header>
  );
}
