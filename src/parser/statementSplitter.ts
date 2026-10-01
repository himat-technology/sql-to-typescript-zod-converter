import type { DialectConfig } from './dialect';
import type { Token } from './tokenizer';
import type { ParseIssue } from './types';

export interface SqlStatement {
  tokens: Token[];
  /** True when the statement ended with `;` or a batch separator. */
  terminated: boolean;
}

const ROUTINE_KEYWORDS = new Set(['TRIGGER', 'FUNCTION', 'PROCEDURE', 'PROC']);

/**
 * Splits a token list into statements. Semicolons inside routine bodies (`BEGIN ... END`) are
 * respected; elsewhere a semicolon or a `CREATE` keyword always starts a new statement, which
 * keeps one malformed statement (e.g. a missing `)`) from swallowing the rest of the input.
 */
export function splitStatements(tokens: Token[], dialect: DialectConfig, issues: ParseIssue[]): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let current: Token[] = [];
  let blockDepth = 0;
  let routine = false;

  const flush = (terminated: boolean) => {
    if (current.length > 0) statements.push({ tokens: current, terminated });
    current = [];
    blockDepth = 0;
    routine = false;
  };

  for (const token of tokens) {
    if (token.type === 'punct' && token.value === ';' && blockDepth === 0) {
      flush(true);
      continue;
    }

    if (token.type === 'word') {
      if (dialect.batchSeparator && token.upper === dialect.batchSeparator && blockDepth === 0) {
        flush(true);
        continue;
      }

      if (routine) {
        if (token.upper === 'BEGIN' || token.upper === 'CASE') blockDepth++;
        else if (token.upper === 'END' && blockDepth > 0) blockDepth--;
      } else if (token.upper === 'CREATE' && current.length > 0) {
        const startsStatement = ['CREATE', 'ALTER', 'DROP', 'INSERT', 'COMMENT'].includes(current[0].upper);
        if (startsStatement && !dialect.optionalSemicolons) {
          issues.push({
            severity: 'warning',
            message: 'Missing semicolon before `CREATE`',
            line: token.line,
            column: token.column,
            suggestion: 'Terminate each statement with `;`.',
          });
        }
        flush(startsStatement);
      }
    }

    current.push(token);

    if (!routine && current.length <= 6 && current[0].upper === 'CREATE' && token.type === 'word' && ROUTINE_KEYWORDS.has(token.upper)) {
      routine = true;
    }
  }

  flush(false);
  return statements;
}
