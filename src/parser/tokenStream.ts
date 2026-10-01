import { SqlSyntaxError, type Locator, type Token } from './tokenizer';

/** Cursor over the tokens of a single SQL statement. */
export class TokenStream {
  pos = 0;
  private readonly tokens: Token[];
  private readonly source: string;
  private readonly locate: Locator;

  constructor(tokens: Token[], source: string, locate: Locator) {
    this.tokens = tokens;
    this.source = source;
    this.locate = locate;
  }

  get length(): number {
    return this.tokens.length;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  previous(): Token | undefined {
    return this.tokens[this.pos - 1];
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  next(context = 'statement'): Token {
    const token = this.tokens[this.pos];
    if (!token) {
      throw this.error(`Unexpected end of ${context}`, undefined, 'The statement appears to be incomplete.');
    }
    this.pos++;
    return token;
  }

  isWord(offset: number, ...words: string[]): boolean {
    const token = this.peek(offset);
    return token !== undefined && token.type === 'word' && (words.length === 0 || words.includes(token.upper));
  }

  isIdentifier(offset = 0): boolean {
    const token = this.peek(offset);
    return token !== undefined && (token.type === 'word' || token.type === 'quoted');
  }

  isPunct(offset: number, value: string): boolean {
    const token = this.peek(offset);
    return token !== undefined && token.type === 'punct' && token.value === value;
  }

  isOperator(offset: number, ...values: string[]): boolean {
    const token = this.peek(offset);
    return token !== undefined && token.type === 'operator' && values.includes(token.value);
  }

  acceptWord(...words: string[]): Token | undefined {
    if (this.isWord(0, ...words)) return this.next();
    return undefined;
  }

  /** Consumes the exact keyword sequence if present. */
  acceptSequence(...words: string[]): boolean {
    for (let i = 0; i < words.length; i++) {
      if (!this.isWord(i, words[i])) return false;
    }
    this.pos += words.length;
    return true;
  }

  acceptPunct(value: string): Token | undefined {
    if (this.isPunct(0, value)) return this.next();
    return undefined;
  }

  expectWord(word: string, context: string): Token {
    if (this.isWord(0, word)) return this.next();
    throw this.unexpected(`Expected \`${word}\` ${context}`);
  }

  expectPunct(value: string, context: string, suggestion?: string): Token {
    if (this.isPunct(0, value)) return this.next();
    throw this.unexpected(`Expected \`${value}\` ${context}`, suggestion);
  }

  /** Raw source text of a token, truncated for messages. */
  text(token: Token): string {
    const raw = this.source.slice(token.start, token.end);
    return raw.length > 40 ? `${raw.slice(0, 37)}...` : raw;
  }

  slice(from: Token, to: Token): string {
    return this.source.slice(from.start, to.end);
  }

  unexpected(message: string, suggestion?: string): SqlSyntaxError {
    const token = this.peek();
    if (!token) return this.error(`${message}, but the statement ended`, undefined, suggestion);
    return this.error(`${message}, but found \`${this.text(token)}\``, token, suggestion);
  }

  error(message: string, token?: Token, suggestion?: string): SqlSyntaxError {
    const at = token ?? this.tokens[this.tokens.length - 1];
    if (!at) return new SqlSyntaxError(message, 1, 1, suggestion);
    if (token) return new SqlSyntaxError(message, at.line, at.column, suggestion);
    const end = this.locate(at.end);
    return new SqlSyntaxError(message, end.line, end.column, suggestion);
  }

  /** Skips a balanced `(...)` or `[...]` group starting at the current token. */
  skipBalanced(): void {
    const open = this.next();
    let depth = 1;
    while (depth > 0) {
      const token = this.peek();
      if (!token) {
        throw this.error(
          `Unclosed \`${open.value}\``,
          open,
          `Add the matching \`${open.value === '(' ? ')' : ']'}\`.`,
        );
      }
      this.pos++;
      if (token.type === 'punct') {
        if (token.value === '(' || token.value === '[') depth++;
        else if (token.value === ')' || token.value === ']') depth--;
      }
    }
  }

  /** Collects the tokens inside a balanced group (excluding the delimiters). */
  readGroup(): Token[] {
    const startPos = this.pos;
    this.skipBalanced();
    return this.tokens.slice(startPos + 1, this.pos - 1);
  }

  /** Advances to the next `,` or `)` at the current nesting depth without consuming it. */
  skipToElementEnd(): void {
    let depth = 0;
    while (!this.atEnd()) {
      const token = this.peek()!;
      if (token.type === 'punct') {
        if (depth === 0 && (token.value === ',' || token.value === ')')) return;
        if (token.value === '(' || token.value === '[') depth++;
        else if (token.value === ')' || token.value === ']') depth--;
      }
      this.pos++;
    }
  }
}
