import type { SqlDialect } from './types';

const SIGNALS: Record<SqlDialect, RegExp[]> = {
  postgresql: [
    /\b(BIG|SMALL)?SERIAL\b/i,
    /\bJSONB\b/i,
    /\bTIMESTAMPTZ\b/i,
    /::\s*[a-z]/i,
    /\bgen_random_uuid\s*\(/i,
    /\buuid_generate_v\d\s*\(/i,
    /\bBYTEA\b/i,
    /\bAS\s+ENUM\b/i,
    /\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b/i,
    /\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i,
  ],
  mysql: [
    /`[^`]+`/,
    /\bAUTO_INCREMENT\b/i,
    /\bENGINE\s*=/i,
    /\bUNSIGNED\b/i,
    /\bTINYINT\b/i,
    /\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/i,
    /\b(DEFAULT\s+)?CHARSET\s*=/i,
    /\bENUM\s*\(/i,
    /\b(LONG|MEDIUM|TINY)TEXT\b/i,
  ],
  sqlite: [
    /\bAUTOINCREMENT\b/i,
    /\bWITHOUT\s+ROWID\b/i,
    /\)\s*STRICT\b/i,
    /\bINTEGER\s+PRIMARY\s+KEY\b/i,
    /\b(datetime|date|strftime)\s*\(\s*'now'/i,
    /\bunixepoch\s*\(/i,
  ],
  tsql: [
    /\[[A-Za-z_][\w ]*\]/,
    /\bIDENTITY\s*\(/i,
    /\bN?VARCHAR\s*\(\s*MAX\s*\)/i,
    /\bNVARCHAR\b/i,
    /\bUNIQUEIDENTIFIER\b/i,
    /^\s*GO\s*$/im,
    /\bGETU?T?C?DATE\s*\(/i,
    /\bSYSU?T?C?DATETIME\s*\(/i,
    /\bNEWID\s*\(/i,
    /\bDATETIME2\b/i,
    /\bdbo\./i,
    /\bDATETIMEOFFSET\b/i,
  ],
};

export interface DialectGuess {
  dialect: SqlDialect;
  score: number;
}

/** Best-effort guess of the dialect a schema was written in, or `undefined` when ambiguous. */
export function detectDialect(sql: string): DialectGuess | undefined {
  if (!sql.trim()) return undefined;
  const sample = sql.length > 50_000 ? sql.slice(0, 50_000) : sql;
  const scores = (Object.keys(SIGNALS) as SqlDialect[])
    .map((dialect) => ({ dialect, score: SIGNALS[dialect].filter((re) => re.test(sample)).length }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (best.score >= 2 && best.score > second.score) return best;
  return undefined;
}
