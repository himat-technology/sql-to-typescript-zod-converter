import { COMPANY } from '../config/company';
import { cx } from './ui';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const LINKS = [
  { label: 'Facebook', href: COMPANY.socials.facebook, icon: FacebookIcon, hover: 'hover:bg-[#1877F2] hover:border-[#1877F2]' },
  { label: 'LinkedIn', href: COMPANY.socials.linkedin, icon: LinkedInIcon, hover: 'hover:bg-[#0A66C2] hover:border-[#0A66C2]' },
  {
    label: 'Instagram',
    href: COMPANY.socials.instagram,
    icon: InstagramIcon,
    hover: 'hover:border-transparent hover:bg-linear-to-tr hover:from-amber-400 hover:via-pink-500 hover:to-purple-600',
  },
];

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cx('flex items-center gap-2', className)}>
      {LINKS.map(({ label, href, icon: Icon, hover }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${COMPANY.name} on ${label} (opens in a new tab)`}
            title={label}
            className={cx(
              'flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors focus-visible:outline-white',
              hover,
            )}
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
