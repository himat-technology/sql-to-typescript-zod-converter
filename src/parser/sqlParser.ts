import type { DialectConfig } from './dialect';
import { getDialect } from './dialects';
import { isKnownTypeName, normalizeTypeName, POST_PARAM_TYPE_WORDS, TYPE_CONTINUATION_WORDS } from './dataTypes';
import { splitStatements } from './statementSplitter';
import { createLocator, SqlSyntaxError, tokenize, type Locator, type SqlComment, type Token } from './tokenizer';
import { TokenStream } from './tokenStream';
import type {
  ColumnReference,
  DatabaseColumn,
  DatabaseSchema,
  DatabaseTable,
  ParseIssue,
  ParseResult,
  SqlDialect,
} from './types';

/** Keywords that end a data type and begin a column constraint/option. */
const COLUMN_OPTION_KEYWORDS = new Set([
  'NOT',
  'NULL',
  'PRIMARY',
  'UNIQUE',
  'DEFAULT',
  'CHECK',
  'REFERENCES',
  'CONSTRAINT',
  'COLLATE',
  'GENERATED',
  'AUTO_INCREMENT',
  'AUTOINCREMENT',
  'IDENTITY',
  'COMMENT',
  'ON',
  'AS',
  'KEY',
  'CHARSET',
  'VISIBLE',
  'INVISIBLE',
  'STORED',
  'VIRTUAL',
  'PERSISTED',
  'SPARSE',
  'ROWGUIDCOL',
  'FILESTREAM',
  'MASKED',
  'ENCRYPTED',
  'COLUMN_FORMAT',
  'STORAGE',
  'SRID',
  'ARRAY',
]);

/** Column options that are accepted and ignored because they don't affect the generated types. */
const IGNORED_COLUMN_FLAGS = new Set([
  'VISIBLE',
  'INVISIBLE',
  'STORED',
  'VIRTUAL',
  'PERSISTED',
  'SPARSE',
  'ROWGUIDCOL',
  'FILESTREAM',
  'ASC',
  'DESC',
  'UNSIGNED',
  'SIGNED',
  'ZEROFILL',
  'CLUSTERED',
  'NONCLUSTERED',
  'DEFERRABLE',
  'BINARY',
]);

const TABLE_CONSTRAINT_KEYWORDS = new Set(['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'EXCLUDE', 'FULLTEXT', 'SPATIAL', 'PERIOD', 'LIKE']);

/** Statements that are valid SQL but irrelevant for type generation. */
const KNOWN_SKIPPABLE_STATEMENTS = new Set([
  'CREATE',
  'DROP',
  'ALTER',
  'INSERT',
  'UPDATE',
  'DELETE',
  'SELECT',
  'WITH',
  'SET',
  'USE',
  'PRAGMA',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'START',
  'END',
  'GRANT',
  'REVOKE',
  'TRUNCATE',
  'LOCK',
  'UNLOCK',
  'DECLARE',
  'EXEC',
  'EXECUTE',
  'PRINT',
  'IF',
  'DELIMITER',
  'ANALYZE',
  'VACUUM',
  'REINDEX',
  'ATTACH',
  'DETACH',
  'SAVEPOINT',
  'RELEASE',
  'COMMENT',
  'REPLACE',
  'MERGE',
  'CALL',
  'DO',
  'SHOW',
  'EXPLAIN',
  'OPTIMIZE',
  'RENAME',
]);

interface ColumnSpan {
  column: DatabaseColumn;
  table: DatabaseTable;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  /** End offset/line of whatever precedes the column (previous element or the opening parenthesis). */
  prevEnd: number;
  prevEndLine: number;
}

interface TableSpan {
  table: DatabaseTable;
  statementStartLine: number;
  openParenLine: number;
  openParenEnd: number;
}

type TableConstraint =
  | { kind: 'primary'; columns: string[]; token: Token }
  | { kind: 'unique'; columns: string[]; token: Token }
  | { kind: 'foreign'; columns: string[]; reference: ColumnReference; token: Token }
  | { kind: 'check'; column?: string; values?: string[]; token: Token }
  | { kind: 'default'; column: string; value: string; token: Token }
  | { kind: 'ignored'; token: Token };

interface QualifiedName {
  name: string;
  schema?: string;
  parts: string[];
}

class DdlParser {
  readonly schema: DatabaseSchema = { tables: [], enums: [] };
  readonly issues: ParseIssue[] = [];
  skippedStatements = 0;
  private readonly skippedKinds = new Map<string, number>();
  private readonly columnSpans: ColumnSpan[] = [];
  private readonly tableSpans: TableSpan[] = [];
  private readonly explicitComments = new WeakSet<object>();
  private partialColumn: DatabaseColumn | undefined;
  /** Token index where a column definition ran into what looks like the next column (missing comma). */
  private missingCommaAt: number | undefined;
  private readonly source: string;
  private readonly dialect: DialectConfig;
  private readonly locate: Locator;

  constructor(source: string, dialect: DialectConfig, locate: Locator) {
    this.source = source;
    this.dialect = dialect;
    this.locate = locate;
  }

  // ---------------------------------------------------------------------------
  // Issues
  // ---------------------------------------------------------------------------

  private warn(message: string, token?: Token, suggestion?: string, severity: ParseIssue['severity'] = 'warning') {
    this.issues.push({ severity, message, line: token?.line, column: token?.column, suggestion });
  }

  private recordError(error: unknown) {
    if (error instanceof SqlSyntaxError) {
      this.issues.push({
        severity: 'error',
        message: error.message,
        line: error.line,
        column: error.column,
        suggestion: error.suggestion,
      });
    } else {
      this.issues.push({
        severity: 'error',
        message: `Internal parser error: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'Try simplifying the statement. The rest of the input was still processed.',
      });
    }
  }

  private skip(kind: string) {
    this.skippedStatements++;
    this.skippedKinds.set(kind, (this.skippedKinds.get(kind) ?? 0) + 1);
  }

  // ---------------------------------------------------------------------------
  // Entry
  // ---------------------------------------------------------------------------

  parseStatement(stream: TokenStream) {
    const first = stream.peek();
    if (!first) return;

    if (first.type !== 'word') {
      throw stream.error(`Unexpected token \`${stream.text(first)}\` at the start of a statement`, first, 'Statements should start with a keyword such as CREATE TABLE.');
    }

    if (first.upper === 'CREATE') {
      let k = 1;
      const modifiers: string[] = [];
      while (stream.isWord(k, 'OR', 'REPLACE', 'GLOBAL', 'LOCAL', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'VIRTUAL', 'EXTERNAL', 'TRANSIENT', 'MEMORY')) {
        modifiers.push(stream.peek(k)!.upper);
        k++;
      }
      const kind = stream.peek(k);
      if (kind?.type === 'word' && kind.upper === 'TABLE') {
        if (modifiers.includes('VIRTUAL') || modifiers.includes('EXTERNAL')) {
          this.warn(`CREATE ${modifiers.join(' ')} TABLE is not supported and was skipped`, first, 'Only regular CREATE TABLE statements generate schemas.');
          this.skip(`CREATE ${modifiers.join(' ')} TABLE`);
          return;
        }
        this.parseCreateTable(stream);
        return;
      }
      if (kind?.type === 'word' && kind.upper === 'TYPE') {
        this.parseCreateType(stream);
        return;
      }
      const label = kind?.type === 'word' ? kind.upper : '';
      this.skip(`CREATE ${label === 'UNIQUE' ? 'UNIQUE INDEX' : label}`.trim());
      return;
    }

    if (first.upper === 'ALTER' && stream.isWord(1, 'TABLE')) {
      this.parseAlterTable(stream);
      return;
    }

    if (first.upper === 'COMMENT' && stream.isWord(1, 'ON')) {
      this.parseCommentOn(stream);
      return;
    }

    if (KNOWN_SKIPPABLE_STATEMENTS.has(first.upper)) {
      const second = stream.peek(1);
      this.skip(second?.type === 'word' && ['DROP', 'ALTER', 'INSERT', 'TRUNCATE'].includes(first.upper) ? `${first.upper} ${second.upper}` : first.upper);
      return;
    }

    this.skippedStatements++;
    this.warn(`Unrecognized statement starting with \`${stream.text(first)}\` was ignored`, first, 'Only CREATE TABLE, CREATE TYPE ... AS ENUM, ALTER TABLE and COMMENT ON statements affect the output.');
  }

  finish(comments: SqlComment[]) {
    this.attachComments(comments);
    this.resolveEnumTypes();

    for (const table of this.schema.tables) {
      if (table.columns.length === 0) {
        this.warn(`Table \`${table.name}\` has no columns`, undefined, 'Add at least one column definition.');
      }
    }

    if (this.skippedKinds.size > 0) {
      const summary = [...this.skippedKinds.entries()].map(([kind, count]) => (count > 1 ? `${kind} ×${count}` : kind)).join(', ');
      this.warn(
        `Skipped ${this.skippedStatements} statement${this.skippedStatements === 1 ? '' : 's'} that ${this.skippedStatements === 1 ? "doesn't" : "don't"} define tables: ${summary}`,
        undefined,
        undefined,
        'info',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Shared readers
  // ---------------------------------------------------------------------------

  private readIdentifier(stream: TokenStream, what: string): string {
    const token = stream.peek();
    if (!token || (token.type !== 'word' && token.type !== 'quoted')) {
      throw stream.unexpected(`Expected ${what}`);
    }
    stream.pos++;
    return token.value;
  }

  private readQualifiedName(stream: TokenStream, what: string): QualifiedName {
    const parts = [this.readIdentifier(stream, what)];
    while (stream.isPunct(0, '.') && stream.isIdentifier(1)) {
      stream.pos++;
      parts.push(this.readIdentifier(stream, what));
    }
    return { name: parts[parts.length - 1], schema: parts.length > 1 ? parts[parts.length - 2] : undefined, parts };
  }

  private findTable(name: QualifiedName): DatabaseTable | undefined {
    const lower = name.name.toLowerCase();
    const schemaLower = name.schema?.toLowerCase();
    const candidates = this.schema.tables.filter((t) => t.name.toLowerCase() === lower);
    if (schemaLower) {
      return candidates.find((t) => t.schema?.toLowerCase() === schemaLower) ?? candidates.find((t) => !t.schema);
    }
    return candidates[0];
  }

  private findColumn(table: DatabaseTable, name: string): DatabaseColumn | undefined {
    const lower = name.toLowerCase();
    return table.columns.find((c) => c.name.toLowerCase() === lower);
  }

  /** Reads `(col [ASC|DESC] [, ...])`, tolerating prefix lengths, collations and opclasses. */
  private readColumnList(stream: TokenStream, context: string): string[] {
    stream.expectPunct('(', `to start the column list of ${context}`);
    const columns: string[] = [];
    while (true) {
      columns.push(this.readIdentifier(stream, `a column name in ${context}`));
      stream.skipToElementEnd();
      if (stream.acceptPunct(',')) continue;
      stream.expectPunct(')', `to close the column list of ${context}`);
      return columns;
    }
  }

  private readReference(stream: TokenStream): ColumnReference {
    const target = this.readQualifiedName(stream, 'a referenced table name');
    let columns: string[] = [];
    if (stream.isPunct(0, '(')) columns = this.readColumnList(stream, 'REFERENCES');
    this.skipReferenceActions(stream);
    return { table: target.parts.join('.'), columns };
  }

  private skipReferenceActions(stream: TokenStream) {
    while (true) {
      if (stream.isWord(0, 'ON') && stream.isWord(1, 'DELETE', 'UPDATE')) {
        stream.pos += 2;
        if (stream.acceptSequence('NO', 'ACTION') || stream.acceptSequence('SET', 'NULL') || stream.acceptSequence('SET', 'DEFAULT')) continue;
        if (stream.acceptWord('CASCADE', 'RESTRICT')) continue;
        throw stream.unexpected('Expected a referential action (CASCADE, RESTRICT, SET NULL, SET DEFAULT, NO ACTION)');
      }
      if (stream.isWord(0, 'MATCH')) {
        stream.pos += 2;
        continue;
      }
      if (stream.acceptSequence('NOT', 'DEFERRABLE') || stream.acceptWord('DEFERRABLE')) continue;
      if (stream.isWord(0, 'INITIALLY')) {
        stream.pos += 2;
        continue;
      }
      if (stream.acceptSequence('NOT', 'FOR', 'REPLICATION')) continue;
      return;
    }
  }

  /**
   * Reads a scalar expression such as a DEFAULT value and returns its source text. Stops before
   * the next column option keyword, comma or closing parenthesis.
   */
  private readExpression(stream: TokenStream, context: string): string {
    const start = stream.peek();
    if (!start || stream.isPunct(0, ',') || stream.isPunct(0, ')')) {
      throw stream.unexpected(`Expected a value after ${context}`);
    }
    this.readPrimary(stream, context);
    while (!stream.atEnd()) {
      if (stream.isOperator(0, '::')) {
        stream.pos++;
        this.readCastType(stream);
      } else if (stream.isOperator(0, '||', '+', '-', '*', '/', '%', '->', '->>') && stream.peek(1) && !stream.isPunct(1, ',') && !stream.isPunct(1, ')')) {
        stream.pos++;
        this.readPrimary(stream, context);
      } else if (stream.isWord(0, 'AT') && stream.isWord(1, 'TIME') && stream.isWord(2, 'ZONE')) {
        stream.pos += 3;
        this.readPrimary(stream, context);
      } else {
        break;
      }
    }
    return stream.slice(start, stream.previous()!);
  }

  private readPrimary(stream: TokenStream, context: string) {
    const token = stream.peek();
    if (!token) throw stream.unexpected(`Expected a value after ${context}`);

    if (token.type === 'punct' && (token.value === '(' || token.value === '[')) {
      stream.skipBalanced();
      return;
    }
    if (token.type === 'operator' && ['-', '+', '~'].includes(token.value)) {
      stream.pos++;
      this.readPrimary(stream, context);
      return;
    }
    if (token.type === 'string' || token.type === 'number' || token.type === 'quoted') {
      stream.pos++;
      return;
    }
    if (token.type === 'word') {
      stream.pos++;
      while (stream.isPunct(0, '.') && stream.isIdentifier(1)) stream.pos += 2;
      if (token.upper === 'ARRAY' && stream.isPunct(0, '[')) {
        stream.skipBalanced();
      } else if (stream.isPunct(0, '(')) {
        stream.skipBalanced();
      } else if (['INTERVAL', 'DATE', 'TIME', 'TIMESTAMP'].includes(token.upper) && stream.peek()?.type === 'string') {
        stream.pos++;
      }
      return;
    }
    throw stream.unexpected(`Expected a value after ${context}`);
  }

  private readCastType(stream: TokenStream) {
    if (!stream.isIdentifier()) throw stream.unexpected('Expected a type name after `::`');
    stream.pos++;
    while (stream.isWord(0) && !COLUMN_OPTION_KEYWORDS.has(stream.peek()!.upper) && TYPE_CONTINUATION_WORDS.has(stream.peek()!.upper)) stream.pos++;
    if (stream.isPunct(0, '(')) stream.skipBalanced();
    while (stream.isPunct(0, '[')) stream.skipBalanced();
  }

  /** Detects enum-like checks: `col IN ('a', 'b')` or `col = ANY (ARRAY['a', 'b'])`. */
  private extractCheckEnum(tokens: Token[]): { column: string; values: string[] } | undefined {
    if (tokens.some((t) => t.type === 'word' && (t.upper === 'OR' || t.upper === 'NOT'))) return undefined;

    const readStrings = (from: number, close: string): string[] | undefined => {
      const values: string[] = [];
      let k = from;
      while (k < tokens.length) {
        const t = tokens[k];
        if (t.type !== 'string') return undefined;
        values.push(t.value);
        k++;
        if (tokens[k]?.type === 'operator' && tokens[k].value === '::') {
          k++;
          while (tokens[k]?.type === 'word') k++;
        }
        const sep = tokens[k];
        if (sep?.type === 'punct' && sep.value === ',') {
          k++;
          continue;
        }
        if (sep?.type === 'punct' && sep.value === close) return values.length ? values : undefined;
        return undefined;
      }
      return undefined;
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'word' && t.type !== 'quoted') continue;
      let j = i + 1;
      if (tokens[j]?.type === 'punct' && tokens[j].value === ')') j++;
      if (tokens[j]?.type === 'operator' && tokens[j].value === '::') {
        j++;
        while (tokens[j]?.type === 'word') j++;
      }
      const next = tokens[j];
      if (next?.type === 'word' && next.upper === 'IN' && tokens[j + 1]?.value === '(') {
        const values = readStrings(j + 2, ')');
        if (values) return { column: t.value, values };
      }
      if (
        next?.type === 'operator' &&
        next.value === '=' &&
        tokens[j + 1]?.upper === 'ANY' &&
        tokens[j + 2]?.value === '(' &&
        tokens[j + 3]?.upper === 'ARRAY' &&
        tokens[j + 4]?.value === '['
      ) {
        const values = readStrings(j + 5, ']');
        if (values) return { column: t.value, values };
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // CREATE TABLE
  // ---------------------------------------------------------------------------

  private parseCreateTable(stream: TokenStream) {
    const createToken = stream.expectWord('CREATE', 'at the start of the statement');
    while (stream.acceptWord('OR', 'REPLACE', 'GLOBAL', 'LOCAL', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'TRANSIENT', 'MEMORY'));
    stream.expectWord('TABLE', 'after CREATE');
    stream.acceptSequence('IF', 'NOT', 'EXISTS');

    if (stream.atEnd() || stream.isPunct(0, '(') || !stream.isIdentifier()) {
      throw stream.error(
        'Could not determine table name',
        stream.peek() ?? createToken,
        'Add a table name after CREATE TABLE, for example `CREATE TABLE users (...)`.',
      );
    }

    const name = this.readQualifiedName(stream, 'a table name');

    if (stream.isWord(0, 'AS')) {
      this.warn(`CREATE TABLE \`${name.name}\` AS SELECT ... is not supported; the table was skipped`, stream.peek(), 'Declare the columns explicitly to generate a schema.');
      this.skip('CREATE TABLE AS');
      return;
    }
    if (stream.isWord(0, 'LIKE') || stream.isWord(0, 'PARTITION') || stream.isWord(0, 'OF') || stream.isWord(0, 'CLONE')) {
      this.warn(`CREATE TABLE \`${name.name}\` ${stream.peek()!.upper} ... is not supported; the table was skipped`, stream.peek(), 'Declare the columns explicitly to generate a schema.');
      this.skip(`CREATE TABLE ${stream.peek()!.upper}`);
      return;
    }

    const open = stream.expectPunct('(', `after table name \`${name.name}\``, 'Column definitions must be wrapped in parentheses: `CREATE TABLE name (column TYPE, ...)`.');

    const table: DatabaseTable = {
      name: name.name,
      schema: name.schema,
      columns: [],
      primaryKey: [],
      uniqueConstraints: [],
    };

    const existingIndex = this.schema.tables.findIndex(
      (t) => t.name.toLowerCase() === table.name.toLowerCase() && (t.schema ?? '').toLowerCase() === (table.schema ?? '').toLowerCase(),
    );
    if (existingIndex >= 0) {
      this.warn(`Table \`${table.name}\` is defined more than once; the last definition is used`, createToken);
      this.schema.tables.splice(existingIndex, 1);
    }
    this.schema.tables.push(table);
    this.tableSpans.push({ table, statementStartLine: createToken.line, openParenLine: open.line, openParenEnd: open.end });

    const complete = this.parseTableBody(stream, table, open);
    if (!complete) return;

    // Table options: ENGINE=InnoDB, WITHOUT ROWID, ON [PRIMARY], COMMENT='...', etc.
    while (!stream.atEnd()) {
      const token = stream.next();
      if (token.type === 'word' && token.upper === 'COMMENT') {
        if (stream.isOperator(0, '=')) stream.pos++;
        const value = stream.peek();
        if (value?.type === 'string') {
          stream.pos++;
          table.comment = value.value;
          this.explicitComments.add(table);
        }
      }
    }
  }

  /** Parses the parenthesised element list. Returns false when the closing parenthesis is missing. */
  private parseTableBody(stream: TokenStream, table: DatabaseTable, open: Token): boolean {
    const constraints: TableConstraint[] = [];
    let prevEnd = open.end;
    let prevEndLine = open.line;
    let complete = false;

    while (true) {
      if (stream.atEnd()) {
        this.issues.push({
          severity: 'error',
          message: `Missing closing \`)\` for CREATE TABLE \`${table.name}\``,
          line: open.line,
          column: open.column,
          suggestion: 'Add `)` after the last column definition. Columns parsed so far are still shown.',
        });
        break;
      }
      if (stream.isPunct(0, ')')) {
        stream.pos++;
        complete = true;
        break;
      }
      if (stream.isPunct(0, ',')) {
        this.warn('Unexpected extra comma in table definition', stream.peek(), 'Remove the duplicate comma.');
        stream.pos++;
        continue;
      }

      const startToken = stream.peek()!;
      const addColumn = (column: DatabaseColumn) => {
        if (this.findColumn(table, column.name)) {
          this.warn(`Duplicate column \`${column.name}\` in table \`${table.name}\`; the first definition is kept`, startToken);
          return;
        }
        table.columns.push(column);
        const endToken = stream.previous()!;
        const endLine = this.locate(endToken.end).line;
        this.columnSpans.push({ column, table, start: startToken.start, end: endToken.end, startLine: startToken.line, endLine, prevEnd, prevEndLine });
      };

      this.partialColumn = undefined;
      this.missingCommaAt = undefined;
      try {
        if (this.isTableConstraintStart(stream)) {
          constraints.push(this.parseTableConstraint(stream));
        } else {
          addColumn(this.parseColumnDefinition(stream, table));
        }
      } catch (error) {
        this.recordError(error);
        // Keep what was understood (name + type) so one typo doesn't drop the column entirely.
        const partial = this.partialColumn as DatabaseColumn | undefined;
        if (partial?.sqlType) addColumn(partial);
        if (this.missingCommaAt === stream.pos) {
          // `a INT b TEXT`: resume at `b` as if the comma were there.
          this.missingCommaAt = undefined;
          this.partialColumn = undefined;
          prevEnd = stream.previous()!.end;
          prevEndLine = this.locate(prevEnd).line;
          continue;
        }
        stream.skipToElementEnd();
      }
      this.missingCommaAt = undefined;
      this.partialColumn = undefined;

      const last = stream.previous();
      if (last) {
        prevEnd = last.end;
        prevEndLine = this.locate(last.end).line;
      }

      if (stream.isPunct(0, ',')) {
        const comma = stream.next();
        prevEnd = comma.end;
        if (stream.isPunct(0, ')')) {
          this.warn(`Trailing comma before \`)\` in table \`${table.name}\``, comma, 'Remove the comma after the last column definition.');
        }
        continue;
      }
      if (stream.isPunct(0, ')') || stream.atEnd()) continue;

      this.recordError(
        stream.error(`Unexpected token \`${stream.text(stream.peek()!)}\` in table \`${table.name}\``, stream.peek(), 'Did you forget a comma between column definitions?'),
      );
      stream.skipToElementEnd();
    }

    for (const constraint of constraints) this.applyConstraint(table, constraint);
    return complete;
  }

  private isTableConstraintStart(stream: TokenStream): boolean {
    const token = stream.peek();
    if (!token || token.type !== 'word') return false;
    if (TABLE_CONSTRAINT_KEYWORDS.has(token.upper)) {
      if (token.upper === 'PRIMARY') return stream.isWord(1, 'KEY');
      if (token.upper === 'FOREIGN') return stream.isWord(1, 'KEY');
      if (token.upper === 'CHECK') return stream.isPunct(1, '(');
      if (token.upper === 'LIKE') return stream.isIdentifier(1);
      return true;
    }
    if (token.upper === 'UNIQUE') {
      return stream.isPunct(1, '(') || stream.isWord(1, 'KEY', 'INDEX', 'CLUSTERED', 'NONCLUSTERED', 'NULLS') || (stream.isIdentifier(1) && stream.isPunct(2, '('));
    }
    if (token.upper === 'KEY' || token.upper === 'INDEX') {
      // `KEY idx_name (col)` vs a column literally named `key`.
      if (stream.isWord(1) && isKnownTypeName(stream.peek(1)!.upper)) return false;
      return stream.isPunct(1, '(') || (stream.isIdentifier(1) && (stream.isPunct(2, '(') || stream.isWord(2, 'USING')));
    }
    return false;
  }

  private parseTableConstraint(stream: TokenStream): TableConstraint {
    const token = stream.peek()!;
    if (stream.acceptWord('CONSTRAINT')) {
      if (stream.isIdentifier() && !stream.isWord(0, 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK', 'DEFAULT', 'EXCLUDE')) stream.pos++;
    }

    if (stream.acceptSequence('PRIMARY', 'KEY')) {
      while (stream.acceptWord('CLUSTERED', 'NONCLUSTERED'));
      if (stream.acceptWord('USING')) stream.pos++;
      const columns = this.readColumnList(stream, 'PRIMARY KEY');
      stream.skipToElementEnd();
      return { kind: 'primary', columns, token };
    }

    if (stream.acceptWord('UNIQUE')) {
      stream.acceptWord('KEY', 'INDEX');
      while (stream.acceptWord('CLUSTERED', 'NONCLUSTERED'));
      stream.acceptSequence('NULLS', 'NOT', 'DISTINCT') || stream.acceptSequence('NULLS', 'DISTINCT');
      if (stream.isIdentifier() && !stream.isWord(0, 'USING')) stream.pos++;
      if (stream.acceptWord('USING')) stream.pos++;
      const columns = this.readColumnList(stream, 'UNIQUE');
      stream.skipToElementEnd();
      return { kind: 'unique', columns, token };
    }

    if (stream.acceptSequence('FOREIGN', 'KEY')) {
      if (stream.isIdentifier()) stream.pos++;
      const columns = this.readColumnList(stream, 'FOREIGN KEY');
      stream.expectWord('REFERENCES', 'after FOREIGN KEY column list');
      const reference = this.readReference(stream);
      stream.skipToElementEnd();
      return { kind: 'foreign', columns, reference, token };
    }

    if (stream.acceptWord('CHECK')) {
      if (!stream.isPunct(0, '(')) throw stream.unexpected('Expected `(` after CHECK');
      const inner = stream.readGroup();
      stream.skipToElementEnd();
      const found = this.extractCheckEnum(inner);
      return { kind: 'check', column: found?.column, values: found?.values, token };
    }

    if (stream.acceptWord('DEFAULT')) {
      const value = this.readExpression(stream, 'DEFAULT');
      stream.expectWord('FOR', 'after the DEFAULT constraint value');
      const column = this.readIdentifier(stream, 'a column name after FOR');
      stream.skipToElementEnd();
      return { kind: 'default', column, value, token };
    }

    if (stream.isWord(0, 'LIKE')) {
      this.warn('`LIKE other_table` clauses inside CREATE TABLE are not expanded', token, 'Copy the referenced columns into this table definition to include them.');
    }
    stream.pos++;
    stream.skipToElementEnd();
    return { kind: 'ignored', token };
  }

  private applyConstraint(table: DatabaseTable, constraint: TableConstraint) {
    const resolve = (name: string): DatabaseColumn | undefined => {
      const column = this.findColumn(table, name);
      if (!column) {
        this.warn(`Constraint on \`${table.name}\` references unknown column \`${name}\``, constraint.token);
      }
      return column;
    };

    switch (constraint.kind) {
      case 'primary': {
        table.primaryKey = constraint.columns.map((name) => resolve(name)?.name ?? name);
        for (const name of constraint.columns) {
          const column = this.findColumn(table, name);
          if (column) {
            column.primaryKey = true;
            column.nullable = false;
          }
        }
        if (constraint.columns.length === 1) {
          const column = this.findColumn(table, constraint.columns[0]);
          if (column) column.unique = true;
        }
        break;
      }
      case 'unique': {
        const columns = constraint.columns.map((name) => resolve(name)?.name ?? name);
        table.uniqueConstraints.push(columns);
        if (columns.length === 1) {
          const column = this.findColumn(table, columns[0]);
          if (column) column.unique = true;
        }
        break;
      }
      case 'foreign': {
        constraint.columns.forEach((name, index) => {
          const column = resolve(name);
          if (column) {
            column.references = {
              table: constraint.reference.table,
              columns: constraint.reference.columns[index] ? [constraint.reference.columns[index]] : [],
            };
          }
        });
        break;
      }
      case 'check': {
        if (constraint.column && constraint.values) {
          const column = this.findColumn(table, constraint.column);
          if (column && !column.enumValues) column.enumValues = constraint.values;
        }
        break;
      }
      case 'default': {
        const column = resolve(constraint.column);
        if (column) column.defaultValue = constraint.value;
        break;
      }
      case 'ignored':
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------

  private parseColumnDefinition(stream: TokenStream, table: DatabaseTable): DatabaseColumn {
    const nameToken = stream.peek();
    if (!nameToken || (nameToken.type !== 'word' && nameToken.type !== 'quoted')) {
      throw stream.unexpected(`Expected a column name in table \`${table.name}\``);
    }
    stream.pos++;

    const column: DatabaseColumn = {
      name: nameToken.value,
      sqlType: '',
      rawType: '',
      typeParams: [],
      isArray: false,
      arrayDimensions: 0,
      unsigned: false,
      nullable: true,
      primaryKey: false,
      unique: false,
      autoIncrement: false,
      generated: false,
    };
    this.partialColumn = column;

    if (stream.isWord(0, 'AS') && stream.isPunct(1, '(')) {
      // T-SQL computed column without a declared type: `total AS (price * quantity) PERSISTED`
      stream.pos++;
      stream.skipBalanced();
      column.generated = true;
    } else if (stream.peek()?.type === 'quoted' || (stream.isWord(0) && !COLUMN_OPTION_KEYWORDS.has(stream.peek()!.upper))) {
      this.parseDataType(stream, column);
    } else if (this.dialect.id !== 'sqlite') {
      this.warn(`Column \`${column.name}\` in \`${table.name}\` has no data type`, nameToken, 'Declare a type such as TEXT or INTEGER.');
    }

    this.parseColumnOptions(stream, column, table);
    return column;
  }

  private parseDataType(stream: TokenStream, column: DatabaseColumn) {
    const first = stream.next('data type');
    const words: string[] = [first.value];
    while (stream.isPunct(0, '.') && stream.isIdentifier(1)) {
      stream.pos++;
      words[words.length - 1] += `.${stream.next().value}`;
    }

    while (stream.isWord(0)) {
      const upper = stream.peek()!.upper;
      if (COLUMN_OPTION_KEYWORDS.has(upper) || !TYPE_CONTINUATION_WORDS.has(upper)) break;
      if (upper === 'CHARACTER' && stream.isWord(1, 'SET')) break;
      if (upper === 'BINARY' && this.dialect.id === 'mysql') break;
      words.push(stream.next().value);
    }

    if (stream.isPunct(0, '(')) {
      column.typeParams = this.readTypeParams(stream);
    }

    while (stream.isWord(0) && POST_PARAM_TYPE_WORDS.has(stream.peek()!.upper)) {
      if (stream.isWord(0, 'WITH', 'WITHOUT') && !stream.isWord(1, 'TIME', 'LOCAL')) break;
      words.push(stream.next().value);
    }

    while (true) {
      if (stream.isPunct(0, '[')) {
        stream.skipBalanced();
        column.isArray = true;
        column.arrayDimensions++;
      } else if (stream.isWord(0, 'ARRAY')) {
        stream.pos++;
        if (stream.isPunct(0, '[')) stream.skipBalanced();
        column.isArray = true;
        column.arrayDimensions++;
      } else {
        break;
      }
    }

    column.rawType = stream.slice(first, stream.previous()!);
    const normalized = normalizeTypeName(words, this.dialect);
    column.sqlType = normalized.base;
    column.unsigned = normalized.unsigned;

    if (column.sqlType === 'ENUM' && column.typeParams.length > 0) {
      column.enumValues = [...column.typeParams];
    }
    if (this.dialect.serialTypes.has(column.sqlType)) {
      column.autoIncrement = true;
      column.nullable = false;
      if (this.dialect.id === 'mysql') column.unique = true;
    }
  }

  private readTypeParams(stream: TokenStream): string[] {
    const tokens = stream.readGroup();
    const params: string[] = [];
    let group: Token[] = [];
    let depth = 0;
    const flush = () => {
      if (group.length === 1 && group[0].type === 'string') params.push(group[0].value);
      else if (group.length > 0) params.push(this.source.slice(group[0].start, group[group.length - 1].end).trim());
      group = [];
    };
    for (const token of tokens) {
      if (token.type === 'punct') {
        if (token.value === '(' || token.value === '[') depth++;
        else if (token.value === ')' || token.value === ']') depth--;
        else if (token.value === ',' && depth === 0) {
          flush();
          continue;
        }
      }
      group.push(token);
    }
    flush();
    return params;
  }

  private parseColumnOptions(stream: TokenStream, column: DatabaseColumn, table: DatabaseTable) {
    while (!stream.atEnd() && !stream.isPunct(0, ',') && !stream.isPunct(0, ')')) {
      const token = stream.peek()!;
      if (token.type !== 'word') {
        throw stream.error(
          `Unexpected token \`${stream.text(token)}\` in definition of column \`${column.name}\``,
          token,
          'Check the syntax of this column, or add a missing comma before the next column.',
        );
      }

      switch (token.upper) {
        case 'CONSTRAINT':
          stream.pos++;
          if (stream.isIdentifier() && !(stream.isWord(0) && COLUMN_OPTION_KEYWORDS.has(stream.peek()!.upper))) stream.pos++;
          break;
        case 'NOT':
          if (stream.isWord(1, 'NULL')) {
            stream.pos += 2;
            column.nullable = false;
          } else if (stream.acceptSequence('NOT', 'FOR', 'REPLICATION') || stream.acceptSequence('NOT', 'DEFERRABLE')) {
            // ignored
          } else {
            stream.pos++;
            throw stream.unexpected('Expected `NULL` after `NOT`');
          }
          break;
        case 'NULL':
          stream.pos++;
          if (!column.primaryKey) column.nullable = true;
          break;
        case 'PRIMARY':
          stream.pos++;
          stream.expectWord('KEY', 'after PRIMARY');
          while (stream.acceptWord('ASC', 'DESC', 'CLUSTERED', 'NONCLUSTERED'));
          if (stream.acceptWord('AUTOINCREMENT')) column.autoIncrement = true;
          column.primaryKey = true;
          column.unique = true;
          column.nullable = false;
          if (!table.primaryKey.some((n) => n.toLowerCase() === column.name.toLowerCase())) table.primaryKey.push(column.name);
          break;
        case 'KEY':
          stream.pos++;
          column.primaryKey = true;
          column.nullable = false;
          if (!table.primaryKey.includes(column.name)) table.primaryKey.push(column.name);
          break;
        case 'UNIQUE':
          stream.pos++;
          stream.acceptWord('KEY');
          while (stream.acceptWord('CLUSTERED', 'NONCLUSTERED'));
          stream.acceptSequence('NULLS', 'NOT', 'DISTINCT') || stream.acceptSequence('NULLS', 'DISTINCT');
          column.unique = true;
          break;
        case 'DEFAULT':
          stream.pos++;
          column.defaultValue = this.readExpression(stream, 'DEFAULT');
          break;
        case 'CHECK': {
          stream.pos++;
          if (!stream.isPunct(0, '(')) throw stream.unexpected('Expected `(` after CHECK');
          const found = this.extractCheckEnum(stream.readGroup());
          if (found && found.column.toLowerCase() === column.name.toLowerCase() && !column.enumValues) {
            column.enumValues = found.values;
          }
          break;
        }
        case 'REFERENCES':
          stream.pos++;
          column.references = this.readReference(stream);
          break;
        case 'COLLATE':
          stream.pos++;
          if (stream.peek()?.type === 'string' || stream.isIdentifier()) stream.pos++;
          while (stream.isPunct(0, '.') && stream.isIdentifier(1)) stream.pos += 2;
          break;
        case 'GENERATED':
          stream.pos++;
          if (!stream.acceptWord('ALWAYS')) stream.acceptSequence('BY', 'DEFAULT');
          stream.acceptSequence('ON', 'NULL');
          stream.expectWord('AS', 'after GENERATED');
          if (stream.acceptWord('IDENTITY')) {
            column.autoIncrement = true;
            column.nullable = false;
            if (stream.isPunct(0, '(')) stream.skipBalanced();
          } else {
            if (!stream.isPunct(0, '(')) throw stream.unexpected('Expected `IDENTITY` or `(expression)` after GENERATED ... AS');
            stream.skipBalanced();
            column.generated = true;
            stream.acceptWord('STORED', 'VIRTUAL', 'PERSISTED');
          }
          break;
        case 'AS':
          stream.pos++;
          if (!stream.isPunct(0, '(')) throw stream.unexpected('Expected `(expression)` after AS');
          stream.skipBalanced();
          column.generated = true;
          stream.acceptWord('STORED', 'VIRTUAL', 'PERSISTED');
          break;
        case 'AUTO_INCREMENT':
        case 'AUTOINCREMENT':
          stream.pos++;
          column.autoIncrement = true;
          break;
        case 'IDENTITY':
          stream.pos++;
          if (stream.isPunct(0, '(')) stream.skipBalanced();
          column.autoIncrement = true;
          column.nullable = false;
          break;
        case 'COMMENT':
          stream.pos++;
          if (stream.peek()?.type !== 'string') throw stream.unexpected('Expected a string after COMMENT');
          column.comment = stream.next().value;
          this.explicitComments.add(column);
          break;
        case 'ON':
          if (stream.isWord(1, 'UPDATE')) {
            stream.pos += 2;
            this.readExpression(stream, 'ON UPDATE');
          } else if (stream.isWord(1, 'CONFLICT')) {
            stream.pos += 3;
          } else {
            stream.pos++;
            throw stream.unexpected('Expected `UPDATE` or `CONFLICT` after `ON`');
          }
          break;
        case 'CHARACTER':
          if (!stream.isWord(1, 'SET')) throw stream.unexpected(`Unexpected keyword in column \`${column.name}\``);
          stream.pos += 3;
          break;
        case 'CHARSET':
        case 'COLUMN_FORMAT':
        case 'STORAGE':
        case 'SRID':
        case 'INITIALLY':
          stream.pos += 2;
          break;
        case 'MASKED':
        case 'ENCRYPTED':
          stream.pos++;
          if (stream.acceptWord('WITH') && stream.isPunct(0, '(')) stream.skipBalanced();
          break;
        default:
          if (IGNORED_COLUMN_FLAGS.has(token.upper)) {
            stream.pos++;
            break;
          }
          if (stream.isWord(1) && isKnownTypeName(stream.peek(1)!.upper)) this.missingCommaAt = stream.pos;
          throw stream.error(
            `Unexpected token \`${stream.text(token)}\` in definition of column \`${column.name}\``,
            token,
            `If \`${stream.text(token)}\` starts a new column, add a comma before it.`,
          );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE TYPE ... AS ENUM (PostgreSQL)
  // ---------------------------------------------------------------------------

  private parseCreateType(stream: TokenStream) {
    stream.expectWord('CREATE', 'at the start of the statement');
    stream.acceptSequence('OR', 'REPLACE');
    stream.expectWord('TYPE', 'after CREATE');
    const name = this.readQualifiedName(stream, 'a type name');
    if (!stream.acceptSequence('AS', 'ENUM')) {
      this.skip('CREATE TYPE');
      return;
    }
    if (!stream.isPunct(0, '(')) throw stream.unexpected('Expected `(` after AS ENUM');
    const values = stream
      .readGroup()
      .filter((t) => t.type === 'string')
      .map((t) => t.value);
    this.schema.enums = this.schema.enums.filter((e) => e.name.toLowerCase() !== name.name.toLowerCase());
    this.schema.enums.push({ name: name.name, schema: name.schema, values });
  }

  private resolveEnumTypes() {
    if (this.schema.enums.length === 0) return;
    const byName = new Map(this.schema.enums.map((e) => [e.name.toUpperCase(), e]));
    for (const table of this.schema.tables) {
      for (const column of table.columns) {
        const typeName = column.sqlType.split('.').pop() ?? '';
        const found = byName.get(typeName);
        if (found) column.enumValues = [...found.values];
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ALTER TABLE
  // ---------------------------------------------------------------------------

  private parseAlterTable(stream: TokenStream) {
    const alterToken = stream.next();
    stream.expectWord('TABLE', 'after ALTER');
    stream.acceptWord('ONLY');
    stream.acceptSequence('IF', 'EXISTS');
    stream.acceptWord('ONLY');
    const name = this.readQualifiedName(stream, 'a table name');
    const table = this.findTable(name);
    if (!table) {
      this.warn(`ALTER TABLE references unknown table \`${name.parts.join('.')}\`; statement ignored`, alterToken, 'Place the CREATE TABLE statement before the ALTER TABLE.');
      this.skippedStatements++;
      return;
    }

    while (!stream.atEnd()) {
      try {
        this.parseAlterAction(stream, table);
      } catch (error) {
        this.recordError(error);
      }
      stream.skipToElementEnd();
      if (!stream.acceptPunct(',')) break;
    }
  }

  private parseAlterAction(stream: TokenStream, table: DatabaseTable) {
    if (stream.acceptWord('ADD')) {
      if (this.isTableConstraintStart(stream) || stream.isWord(0, 'CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK')) {
        this.applyConstraint(table, this.parseTableConstraint(stream));
        return;
      }
      stream.acceptWord('COLUMN');
      stream.acceptSequence('IF', 'NOT', 'EXISTS');
      const column = this.parseColumnDefinition(stream, table);
      if (!this.findColumn(table, column.name)) table.columns.push(column);
      return;
    }

    if (stream.acceptWord('ALTER')) {
      stream.acceptWord('COLUMN');
      const name = this.readIdentifier(stream, 'a column name');
      const column = this.findColumn(table, name);
      if (!column) {
        this.warn(`ALTER TABLE \`${table.name}\` references unknown column \`${name}\``, stream.previous());
        return;
      }
      if (stream.acceptSequence('SET', 'NOT', 'NULL')) column.nullable = false;
      else if (stream.acceptSequence('DROP', 'NOT', 'NULL')) column.nullable = true;
      else if (stream.acceptSequence('SET', 'DEFAULT')) column.defaultValue = this.readExpression(stream, 'SET DEFAULT');
      else if (stream.acceptSequence('DROP', 'DEFAULT')) column.defaultValue = undefined;
      else if (stream.acceptSequence('SET', 'DATA', 'TYPE') || stream.acceptWord('TYPE')) {
        this.parseDataType(stream, column);
        if (stream.acceptWord('USING')) this.readExpression(stream, 'USING');
      } else if (this.dialect.id === 'tsql' && stream.isIdentifier()) {
        this.parseDataType(stream, column);
        column.nullable = true;
        this.parseColumnOptions(stream, column, table);
      }
      return;
    }

    if (stream.acceptWord('MODIFY')) {
      stream.acceptWord('COLUMN');
      this.replaceColumn(table, undefined, this.parseColumnDefinition(stream, table));
      return;
    }

    if (stream.acceptWord('CHANGE')) {
      stream.acceptWord('COLUMN');
      const oldName = this.readIdentifier(stream, 'a column name');
      this.replaceColumn(table, oldName, this.parseColumnDefinition(stream, table));
      return;
    }

    if (stream.isWord(0, 'DROP') && !stream.isWord(1, 'CONSTRAINT', 'INDEX', 'KEY', 'PRIMARY', 'FOREIGN', 'CHECK')) {
      stream.pos++;
      stream.acceptWord('COLUMN');
      stream.acceptSequence('IF', 'EXISTS');
      const name = this.readIdentifier(stream, 'a column name');
      table.columns = table.columns.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
      return;
    }

    if (stream.acceptSequence('RENAME', 'COLUMN') || (stream.isWord(0, 'RENAME') && stream.isIdentifier(1) && stream.isWord(2, 'TO'))) {
      if (stream.isWord(0, 'RENAME')) stream.pos++;
      const from = this.readIdentifier(stream, 'a column name');
      stream.expectWord('TO', 'in RENAME COLUMN');
      const to = this.readIdentifier(stream, 'a new column name');
      const column = this.findColumn(table, from);
      if (column) column.name = to;
      return;
    }

    if (stream.acceptSequence('RENAME', 'TO')) {
      table.name = this.readQualifiedName(stream, 'a new table name').name;
    }
  }

  private replaceColumn(table: DatabaseTable, oldName: string | undefined, column: DatabaseColumn) {
    const index = table.columns.findIndex((c) => c.name.toLowerCase() === (oldName ?? column.name).toLowerCase());
    if (index >= 0) {
      const previous = table.columns[index];
      column.primaryKey ||= previous.primaryKey;
      if (column.primaryKey) column.nullable = false;
      table.columns[index] = column;
    } else {
      table.columns.push(column);
    }
  }

  // ---------------------------------------------------------------------------
  // COMMENT ON (PostgreSQL)
  // ---------------------------------------------------------------------------

  private parseCommentOn(stream: TokenStream) {
    stream.pos += 2;
    const target = stream.acceptWord('TABLE', 'COLUMN');
    if (!target) {
      this.skip('COMMENT ON');
      return;
    }
    const name = this.readQualifiedName(stream, 'a comment target');
    stream.expectWord('IS', 'in COMMENT ON');
    const value = stream.peek();
    const text = value?.type === 'string' ? value.value : undefined;

    if (target.upper === 'TABLE') {
      const table = this.findTable(name);
      if (table) {
        table.comment = text;
        this.explicitComments.add(table);
      }
      return;
    }

    const columnName = name.parts[name.parts.length - 1];
    const tableParts = name.parts.slice(0, -1);
    const table = this.findTable({
      name: tableParts[tableParts.length - 1] ?? '',
      schema: tableParts.length > 1 ? tableParts[tableParts.length - 2] : undefined,
      parts: tableParts,
    });
    const column = table && this.findColumn(table, columnName);
    if (column) {
      column.comment = text;
      this.explicitComments.add(column);
    } else {
      this.warn(`COMMENT ON COLUMN references unknown column \`${name.parts.join('.')}\``, stream.previous());
    }
  }

  // ---------------------------------------------------------------------------
  // SQL comments → column / table documentation
  // ---------------------------------------------------------------------------

  private attachComments(comments: SqlComment[]) {
    if (comments.length === 0) return;
    const used = new Set<SqlComment>();
    const lineComments = comments.filter((c) => c.line === c.endLine || c.kind === 'block');

    // Trailing comments on the same line as a column: `email TEXT NOT NULL, -- login email`
    for (const comment of lineComments) {
      let owner: ColumnSpan | undefined;
      for (const span of this.columnSpans) {
        if (span.endLine === comment.line && span.end <= comment.start) {
          if (!owner || span.end > owner.end) owner = span;
        }
      }
      if (owner && !this.explicitComments.has(owner.column) && !owner.column.comment) {
        owner.column.comment = comment.text;
        used.add(comment);
      }
    }

    // Comment on its own line directly above a column.
    for (const span of this.columnSpans) {
      if (span.column.comment) continue;
      const above = lineComments.filter(
        (c) => !used.has(c) && c.endLine === span.startLine - 1 && c.start >= span.prevEnd && c.line !== span.prevEndLine,
      );
      if (above.length > 0) {
        span.column.comment = above.map((c) => c.text).join('\n');
        above.forEach((c) => used.add(c));
      }
    }

    // Table comments: on the `CREATE TABLE x (` line, or directly above the statement.
    for (const span of this.tableSpans) {
      if (span.table.comment || this.explicitComments.has(span.table)) continue;
      const inline = lineComments.find((c) => !used.has(c) && c.line === span.openParenLine && c.start >= span.openParenEnd);
      const above = lineComments.find((c) => !used.has(c) && c.endLine === span.statementStartLine - 1);
      const chosen = inline ?? above;
      if (chosen) {
        span.table.comment = chosen.text;
        used.add(chosen);
      }
    }
  }
}

/**
 * Parses SQL DDL into a normalized schema. Never throws: syntax problems are reported as issues and
 * every statement that can be understood is still returned.
 */
export function parseSql(source: string, dialectId: SqlDialect): ParseResult {
  const dialect = getDialect(dialectId);
  const issues: ParseIssue[] = [];
  const emptySchema: DatabaseSchema = { tables: [], enums: [] };

  if (!source.trim()) {
    return { schema: emptySchema, issues, skippedStatements: 0 };
  }

  const locate = createLocator(source);
  let tokens: Token[];
  let comments: SqlComment[];
  let truncated = false;

  try {
    ({ tokens, comments } = tokenize(source, dialect));
  } catch (error) {
    if (!(error instanceof SqlSyntaxError)) throw error;
    issues.push({ severity: 'error', message: error.message, line: error.line, column: error.column, suggestion: error.suggestion });
    // Recover everything before the lexical error.
    const lines = source.split('\n');
    const offset = lines.slice(0, error.line - 1).reduce((sum, l) => sum + l.length + 1, 0) + error.column - 1;
    try {
      ({ tokens, comments } = tokenize(source.slice(0, offset), dialect));
      truncated = true;
    } catch {
      return { schema: emptySchema, issues, skippedStatements: 0 };
    }
  }

  const parser = new DdlParser(source, dialect, locate);
  const statements = splitStatements(tokens, dialect, parser.issues);
  if (truncated && statements.length > 0 && !statements[statements.length - 1].terminated) {
    statements.pop();
  }

  for (const statement of statements) {
    const stream = new TokenStream(statement.tokens, source, locate);
    try {
      parser.parseStatement(stream);
    } catch (error) {
      if (error instanceof SqlSyntaxError) {
        parser.issues.push({ severity: 'error', message: error.message, line: error.line, column: error.column, suggestion: error.suggestion });
      } else {
        parser.issues.push({
          severity: 'error',
          message: `Internal parser error: ${error instanceof Error ? error.message : String(error)}`,
          line: statement.tokens[0]?.line,
          column: statement.tokens[0]?.column,
        });
      }
    }
  }

  parser.finish(comments);
  issues.push(...parser.issues);

  if (parser.schema.tables.length === 0 && !issues.some((i) => i.severity === 'error')) {
    issues.push({
      severity: 'error',
      message: 'No CREATE TABLE statements found',
      suggestion: 'Paste one or more `CREATE TABLE name (...)` statements, or load an example preset.',
    });
  }

  issues.sort((a, b) => (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER));

  return { schema: parser.schema, issues, skippedStatements: parser.skippedStatements };
}
