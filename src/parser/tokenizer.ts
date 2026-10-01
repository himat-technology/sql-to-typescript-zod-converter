import type { DialectConfig } from './dialect';

export type TokenType = 'word' | 'quoted' | 'string' | 'number' | 'punct' | 'operator';

export interface Token {
  type: TokenType;
  /** Semantic value: unescaped content for strings / quoted identifiers, raw text otherwise. */
  value: string;
  /** Upper-cased value, handy for keyword comparisons. */
  upper: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface SqlComment {
  kind: 'line' | 'block';
  text: string;
  start: number;
  end: number;
  line: number;
  endLine: number;
}

export interface TokenizeResult {
  tokens: Token[];
  comments: SqlComment[];
}

export class SqlSyntaxError extends Error {
  readonly line: number;
  readonly column: number;
  readonly suggestion?: string;

  constructor(message: string, line: number, column: number, suggestion?: string) {
    super(message);
    this.name = 'SqlSyntaxError';
    this.line = line;
    this.column = column;
    this.suggestion = suggestion;
  }
}

export interface Locator {
  (offset: number): { line: number; column: number };
}

export function createLocator(source: string): Locator {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  return (offset: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
  };
}

const PUNCTUATION = new Set(['(', ')', ',', ';', '.', '[', ']', '{', '}']);
const MULTI_CHAR_OPERATORS = ['->>', '#>>', '::', '||', '<=', '>=', '<>', '!=', '=>', '->', '#>', '@>', '<@', ':='];

function isWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 11 || code === 0xa0 || code === 0xfeff;
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch.charCodeAt(0) >= 0x80;
}

function isIdentPart(ch: string | undefined): boolean {
  return isIdentStart(ch) || isDigit(ch) || ch === '$';
}

function unescapeBackslashes(text: string): string {
  return text.replace(/\\(.)/gs, (_, ch: string) => {
    switch (ch) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '0':
        return '\0';
      default:
        return ch;
    }
  });
}

/**
 * Converts SQL source text into a flat token list. Comments are collected separately so the
 * parser can attach them to columns without having to skip them everywhere.
 */
export function tokenize(source: string, dialect: DialectConfig): TokenizeResult {
  const locate = createLocator(source);
  const tokens: Token[] = [];
  const comments: SqlComment[] = [];
  const n = source.length;
  let i = 0;

  const push = (type: TokenType, start: number, end: number, value?: string) => {
    const raw = source.slice(start, end);
    const v = value ?? raw;
    const { line, column } = locate(start);
    tokens.push({ type, value: v, upper: v.toUpperCase(), start, end, line, column });
  };

  const fail = (offset: number, message: string, suggestion?: string): never => {
    const { line, column } = locate(offset);
    throw new SqlSyntaxError(message, line, column, suggestion);
  };

  const readQuoted = (start: number, quoteStart: number, close: string, allowBackslash: boolean, kind: 'string' | 'identifier') => {
    let j = quoteStart + 1;
    let content = '';
    let segmentStart = j;
    while (true) {
      if (j >= n) {
        if (kind === 'string') {
          fail(start, 'Unterminated string literal', `Add the closing ${close} quote to the string that starts here.`);
        } else {
          fail(start, 'Unterminated quoted identifier', `Add the closing ${close} to the identifier that starts here.`);
        }
      }
      const ch = source[j];
      if (allowBackslash && ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === close) {
        if (source[j + 1] === close) {
          content += source.slice(segmentStart, j + 1);
          j += 2;
          segmentStart = j;
          continue;
        }
        content += source.slice(segmentStart, j);
        return { end: j + 1, content: allowBackslash ? unescapeBackslashes(content) : content };
      }
      j++;
    }
  };

  while (i < n) {
    const ch = source[i];
    const code = source.charCodeAt(i);

    if (isWhitespace(code)) {
      i++;
      continue;
    }

    // Line comments: `-- ...` and MySQL `# ...`
    if ((ch === '-' && source[i + 1] === '-') || (ch === '#' && dialect.hashComments)) {
      const start = i;
      let j = source.indexOf('\n', i);
      if (j === -1) j = n;
      const text = source.slice(start + (ch === '#' ? 1 : 2), j).trim();
      const { line } = locate(start);
      comments.push({ kind: 'line', text, start, end: j, line, endLine: line });
      i = j;
      continue;
    }

    // Block comments
    if (ch === '/' && source[i + 1] === '*') {
      const start = i;
      const close = source.indexOf('*/', i + 2);
      if (close === -1) {
        fail(start, 'Unterminated block comment', 'Close the comment with */.');
      }
      const end = close + 2;
      const text = source
        .slice(start + 2, close)
        .split('\n')
        .map((l) => l.replace(/^\s*\*?\s?/, '').trimEnd())
        .join('\n')
        .trim();
      comments.push({ kind: 'block', text, start, end, line: locate(start).line, endLine: locate(end).line });
      i = end;
      continue;
    }

    // Prefixed string literals: N'...', E'...', X'...', B'...'
    if (/[NnEeXxBb]/.test(ch) && source[i + 1] === "'") {
      const allowBackslash = dialect.backslashEscapes || ch === 'E' || ch === 'e';
      const { end, content } = readQuoted(i, i + 1, "'", allowBackslash, 'string');
      push('string', i, end, content);
      i = end;
      continue;
    }

    if (ch === "'") {
      const { end, content } = readQuoted(i, i, "'", dialect.backslashEscapes, 'string');
      push('string', i, end, content);
      i = end;
      continue;
    }

    if (ch === '"' && dialect.doubleQuotedStrings) {
      const { end, content } = readQuoted(i, i, '"', dialect.backslashEscapes, 'string');
      push('string', i, end, content);
      i = end;
      continue;
    }

    const quote = dialect.identifierQuotes.find(([open]) => open === ch);
    if (quote) {
      const { end, content } = readQuoted(i, i, quote[1], false, 'identifier');
      push('quoted', i, end, content);
      i = end;
      continue;
    }

    if (ch === '$' && dialect.dollarQuotedStrings) {
      const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(i, i + 64));
      if (match) {
        const tag = match[0];
        const close = source.indexOf(tag, i + tag.length);
        if (close === -1) {
          fail(i, `Unterminated dollar-quoted string ${tag}`, `Close the string with ${tag}.`);
        }
        push('string', i, close + tag.length, source.slice(i + tag.length, close));
        i = close + tag.length;
        continue;
      }
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1]))) {
      let j = i;
      if (ch === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        j += 2;
        while (j < n && /[0-9a-fA-F]/.test(source[j])) j++;
      } else {
        while (isDigit(source[j])) j++;
        if (source[j] === '.' && source[j + 1] !== '.') {
          j++;
          while (isDigit(source[j])) j++;
        }
        if ((source[j] === 'e' || source[j] === 'E') && (isDigit(source[j + 1]) || ((source[j + 1] === '+' || source[j + 1] === '-') && isDigit(source[j + 2])))) {
          j += 2;
          while (isDigit(source[j])) j++;
        }
      }
      push('number', i, j);
      i = j;
      continue;
    }

    if (isIdentStart(ch) || (dialect.sigilIdentifiers && (ch === '@' || ch === '#') && (isIdentStart(source[i + 1]) || source[i + 1] === '#' || source[i + 1] === '@'))) {
      let j = i + 1;
      while (j < n && (isIdentPart(source[j]) || (dialect.sigilIdentifiers && (source[j] === '#' || source[j] === '@')))) j++;
      push('word', i, j);
      i = j;
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      push('punct', i, i + 1);
      i++;
      continue;
    }

    const op = MULTI_CHAR_OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (op) {
      push('operator', i, i + op.length);
      i += op.length;
      continue;
    }

    push('operator', i, i + 1);
    i++;
  }

  return { tokens, comments };
}
