export type HighlightClass = 'plain' | 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'function' | 'property' | 'identifier';

export interface HighlightToken {
  text: string;
  cls: HighlightClass;
}

const SQL_KEYWORDS = new Set(
  (
    'ADD ALL ALTER ALWAYS AND ARRAY AS ASC AUTO_INCREMENT AUTOINCREMENT BEGIN BY CASCADE CHARACTER CHARSET CHECK CLUSTERED COLLATE ' +
    'COLUMN COMMENT COMMIT CONSTRAINT CREATE CURRENT_DATE CURRENT_TIMESTAMP DEFAULT DEFERRABLE DELETE DESC DROP ENGINE ENUM EXISTS ' +
    'FALSE FOR FOREIGN FROM GENERATED GO IDENTITY IF IN INDEX INSERT INTO IS KEY LIKE NO NONCLUSTERED NOT NULL ON OR PRIMARY ' +
    'REFERENCES REPLACE RESTRICT ROWID SET STORED STRICT TABLE TEMP TEMPORARY TO TRUE TYPE UNIQUE UNSIGNED UPDATE USING VALUES ' +
    'VIRTUAL WITH WITHOUT ZONE ACTION PERSISTED'
  ).split(' '),
);

const SQL_TYPES = new Set(
  (
    'BIGINT BIGSERIAL BINARY BIT BLOB BOOL BOOLEAN BYTEA CHAR CITEXT CLOB DATE DATETIME DATETIME2 DATETIMEOFFSET DECIMAL DOUBLE ' +
    'FLOAT IMAGE INET INT INTEGER INTERVAL JSON JSONB LONGBLOB LONGTEXT MEDIUMINT MEDIUMTEXT MONEY NCHAR NUMERIC NTEXT NVARCHAR ' +
    'PRECISION REAL ROWVERSION SERIAL SMALLINT SMALLSERIAL TEXT TIME TIMESTAMP TIMESTAMPTZ TINYINT TINYTEXT UNIQUEIDENTIFIER UUID ' +
    'VARBINARY VARCHAR XML YEAR MAX'
  ).split(' '),
);

const TS_KEYWORDS = new Set(
  'import from export const let type interface extends typeof keyof null undefined true false return as satisfies readonly'.split(' '),
);
const TS_TYPES = new Set('string number boolean unknown never any Date Record Array'.split(' '));

const SQL_PATTERN = /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:''|[^'])*'?)|("(?:""|[^"])*"?|`[^`]*`?|\[[^\]\n]*\]?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w$]*)/g;
const TS_PATTERN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

function pushToken(tokens: HighlightToken[], text: string, cls: HighlightClass) {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.cls === cls) last.text += text;
  else tokens.push({ text, cls });
}

export function highlightSql(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let last = 0;
  for (const match of source.matchAll(SQL_PATTERN)) {
    const index = match.index ?? 0;
    pushToken(tokens, source.slice(last, index), 'plain');
    const [text, comment, str, quoted, num, word] = match;
    if (comment) pushToken(tokens, text, 'comment');
    else if (str) pushToken(tokens, text, 'string');
    else if (quoted) pushToken(tokens, text, 'identifier');
    else if (num) pushToken(tokens, text, 'number');
    else if (word) {
      const upper = word.toUpperCase();
      pushToken(tokens, text, SQL_KEYWORDS.has(upper) ? 'keyword' : SQL_TYPES.has(upper) ? 'type' : 'plain');
    }
    last = index + text.length;
  }
  pushToken(tokens, source.slice(last), 'plain');
  return tokens;
}

export function highlightTs(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let last = 0;
  for (const match of source.matchAll(TS_PATTERN)) {
    const index = match.index ?? 0;
    pushToken(tokens, source.slice(last, index), 'plain');
    const [text, comment, str, num, word] = match;
    const end = index + text.length;
    if (comment) pushToken(tokens, text, 'comment');
    else if (str) pushToken(tokens, text, 'string');
    else if (num) pushToken(tokens, text, 'number');
    else if (word) {
      const after = source.slice(end, end + 2);
      let cls: HighlightClass = 'plain';
      if (TS_KEYWORDS.has(word)) cls = 'keyword';
      else if (TS_TYPES.has(word) || /^[A-Z]/.test(word)) cls = 'type';
      else if (after.startsWith('(')) cls = 'function';
      else if (after.startsWith(':') || after === '?:') cls = 'property';
      pushToken(tokens, text, cls);
    }
    last = end;
  }
  pushToken(tokens, source.slice(last), 'plain');
  return tokens;
}
