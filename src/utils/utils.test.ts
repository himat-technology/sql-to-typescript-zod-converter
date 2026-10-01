// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';
import { createSourceBlob, DEFAULT_EXPORT_FILENAME, downloadTextFile, sanitizeFileName } from './fileExport';
import { highlightSql, highlightTs } from './highlight';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('file export', () => {
  it('sanitizes file names and enforces the .ts extension', () => {
    expect(sanitizeFileName('my schema')).toBe('my-schema.ts');
    expect(sanitizeFileName('types.ts')).toBe('types.ts');
    expect(sanitizeFileName('../../etc/passwd')).toBe('..-..-etc-passwd.ts');
    expect(sanitizeFileName('   ')).toBe(DEFAULT_EXPORT_FILENAME);
  });

  it('creates a TypeScript blob with the exact content', async () => {
    const blob = createSourceBlob('export const a = 1;\n');
    expect(blob.type).toContain('text/typescript');
    expect(await blob.text()).toBe('export const a = 1;\n');
  });

  it('downloads through an object URL and a temporary anchor', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:mock';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });

    expect(downloadTextFile('export {};', DEFAULT_EXPORT_FILENAME)).toBe(true);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('sql-to-typescript-zod.ts');
    expect(clicks[0].href).toBe('blob:mock');
    expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe('export {};');
    expect(document.querySelectorAll('a').length).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
  });
});

describe('clipboard', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(await copyToClipboard('fallback')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('reports failure when no copy mechanism works', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    expect(await copyToClipboard('x')).toBe(false);
  });
});

describe('syntax highlighting', () => {
  it('round-trips SQL and TypeScript text exactly', () => {
    const sql = "CREATE TABLE t (id INT DEFAULT 'x' -- c\n);";
    expect(highlightSql(sql).map((t) => t.text).join('')).toBe(sql);
    const ts = 'export const a = z.string(); // c\nexport type A = { b?: string };';
    expect(highlightTs(ts).map((t) => t.text).join('')).toBe(ts);
  });

  it('classifies keywords, strings and comments', () => {
    const tokens = highlightSql("CREATE TABLE t (a TEXT DEFAULT 'x'); -- done");
    expect(tokens.find((t) => t.text.includes('CREATE'))?.cls).toBe('keyword');
    expect(tokens.find((t) => t.text === "'x'")?.cls).toBe('string');
    expect(tokens.find((t) => t.text === '-- done')?.cls).toBe('comment');
  });
});
