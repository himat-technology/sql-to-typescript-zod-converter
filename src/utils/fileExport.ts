export const DEFAULT_EXPORT_FILENAME = 'sql-to-typescript-zod.ts';

/** Makes a safe file name and guarantees the given extension. */
export function sanitizeFileName(name: string, extension = '.ts'): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = cleaned || DEFAULT_EXPORT_FILENAME.replace(/\.ts$/, '');
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export function createSourceBlob(content: string): Blob {
  return new Blob([content], { type: 'text/typescript;charset=utf-8' });
}

/** Triggers a client-side download of `content` (no server involved). */
export function downloadTextFile(content: string, fileName = DEFAULT_EXPORT_FILENAME): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(createSourceBlob(content));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFileName(fileName);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}
