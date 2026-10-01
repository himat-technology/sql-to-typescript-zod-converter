import { ExternalLink, Globe, Mail, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY } from '../config/company';
import { HiMatLogo } from './Header';
import { SocialLinks } from './SocialLinks';

export function Footer() {
  return (
    <footer className="relative mt-4 overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-300">
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <HiMatLogo size={34} />
            <span className="text-lg font-semibold">{COMPANY.name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            Free, privacy-first developer tools. Convert SQL DDL into type-safe TypeScript and Zod schemas without your schema ever leaving the browser.
          </p>
          <SocialLinks className="mt-5" />
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Contact</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li>
              <a href={`mailto:${COMPANY.email}`} className="group inline-flex items-center gap-3 hover:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300 group-hover:bg-pink-500/30">
                  <Mail size={15} aria-hidden="true" />
                </span>
                {COMPANY.email}
              </a>
            </li>
            <li>
              <a href={COMPANY.phoneHref} className="group inline-flex items-center gap-3 hover:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30">
                  <Phone size={15} aria-hidden="true" />
                </span>
                {COMPANY.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-3 hover:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 group-hover:bg-sky-500/30">
                  <Globe size={15} aria-hidden="true" />
                </span>
                {COMPANY.websiteLabel}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Try it online</h2>
          <p className="mt-4 text-sm text-slate-300">Use the hosted version of this tool on the HiMat Tech free tools site.</p>
          <a
            href={COMPANY.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-cyan-400 via-sky-400 to-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition-opacity hover:opacity-90 focus-visible:outline-white"
          >
            Open live demo
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <p className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck size={14} aria-hidden="true" />
            Runs 100% in your browser. No SQL is uploaded.
          </p>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400 sm:px-6">
          <span>
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </span>
          <span>PostgreSQL · MySQL · SQLite · T-SQL → TypeScript &amp; Zod</span>
        </div>
      </div>
    </footer>
  );
}
