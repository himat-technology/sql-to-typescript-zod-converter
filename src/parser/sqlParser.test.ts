import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { detectDialect } from './dialectDetection';
import { parseSql } from './sqlParser';
import type { DatabaseTable } from './types';

const col = (table: DatabaseTable, name: string) => {
  const found = table.columns.find((c) => c.name === name);
  if (!found) throw new Error(`column ${name} not found in ${table.name}`);
  return found;
};

const errors = (sql: string, dialect: Parameters<typeof parseSql>[1] = 'postgresql') =>
  parseSql(sql, dialect).issues.filter((i) => i.severity === 'error');

describe('PostgreSQL parsing', () => {
  const sql = `
    CREATE TABLE public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      price NUMERIC(10, 2) NOT NULL,
      bio TEXT,
      tags TEXT[] DEFAULT '{}'::text[],
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      counter BIGSERIAL,
      ident INTEGER GENERATED ALWAYS AS IDENTITY
    );`;
  const result = parseSql(sql, 'postgresql');
  const users = result.schema.tables[0];

  it('parses table and schema names', () => {
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(users.name).toBe('users');
    expect(users.schema).toBe('public');
    expect(users.columns).toHaveLength(9);
  });

  it('captures types and parameters', () => {
    expect(col(users, 'email').sqlType).toBe('VARCHAR');
    expect(col(users, 'email').typeParams).toEqual(['255']);
    expect(col(users, 'price').typeParams).toEqual(['10', '2']);
    expect(col(users, 'price').rawType).toBe('NUMERIC(10, 2)');
    expect(col(users, 'created_at').sqlType).toBe('TIMESTAMPTZ');
    expect(col(users, 'tags').isArray).toBe(true);
  });

  it('captures defaults including casts and function calls', () => {
    expect(col(users, 'id').defaultValue).toBe('gen_random_uuid()');
    expect(col(users, 'meta').defaultValue).toBe("'{}'::jsonb");
    expect(col(users, 'tags').defaultValue).toBe("'{}'::text[]");
    expect(col(users, 'created_at').defaultValue).toBe('now()');
  });

  it('treats SERIAL and IDENTITY as auto-increment, non-null columns', () => {
    expect(col(users, 'counter').autoIncrement).toBe(true);
    expect(col(users, 'counter').nullable).toBe(false);
    expect(col(users, 'ident').autoIncrement).toBe(true);
  });

  it('parses CREATE TYPE enums and resolves them on columns', () => {
    const parsed = parseSql(
      `CREATE TYPE mood AS ENUM ('happy', 'sad');
       CREATE TABLE people (id SERIAL PRIMARY KEY, current_mood mood NOT NULL);`,
      'postgresql',
    );
    expect(parsed.schema.enums).toEqual([{ name: 'mood', schema: undefined, values: ['happy', 'sad'] }]);
    expect(col(parsed.schema.tables[0], 'current_mood').enumValues).toEqual(['happy', 'sad']);
  });

  it('applies COMMENT ON and ALTER TABLE ADD PRIMARY KEY', () => {
    const parsed = parseSql(
      `CREATE TABLE t (id integer NOT NULL, name text);
       ALTER TABLE ONLY public.t ADD CONSTRAINT t_pkey PRIMARY KEY (id);
       ALTER TABLE t ALTER COLUMN name SET NOT NULL;
       COMMENT ON COLUMN t.name IS 'Display name';`,
      'postgresql',
    );
    const t = parsed.schema.tables[0];
    expect(t.primaryKey).toEqual(['id']);
    expect(col(t, 'id').primaryKey).toBe(true);
    expect(col(t, 'name').nullable).toBe(false);
    expect(col(t, 'name').comment).toBe('Display name');
  });
});

describe('MySQL parsing', () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS \`accounts\` (
      \`id\` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
      \`email\` VARCHAR(191) NOT NULL COMMENT 'Login email',
      \`role\` ENUM('user','admin') NOT NULL DEFAULT 'user',
      \`verified\` TINYINT(1) NOT NULL DEFAULT 0,
      \`bio\` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      \`status\` VARCHAR(20) DEFAULT "active",
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`email_unique\` (\`email\`),
      KEY \`idx_role\` (\`role\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Accounts table';`;
  const result = parseSql(sql, 'mysql');
  const table = result.schema.tables[0];

  it('parses backtick identifiers and MySQL options', () => {
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(table.name).toBe('accounts');
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'email', 'role', 'verified', 'bio', 'status', 'updated_at']);
    expect(table.comment).toBe('Accounts table');
  });

  it('captures unsigned, auto increment, enum values and comments', () => {
    expect(col(table, 'id').unsigned).toBe(true);
    expect(col(table, 'id').autoIncrement).toBe(true);
    expect(col(table, 'id').primaryKey).toBe(true);
    expect(col(table, 'role').enumValues).toEqual(['user', 'admin']);
    expect(col(table, 'email').comment).toBe('Login email');
    expect(col(table, 'email').unique).toBe(true);
    expect(col(table, 'status').defaultValue).toBe('"active"');
    expect(col(table, 'updated_at').defaultValue).toBe('CURRENT_TIMESTAMP');
  });
});

describe('SQLite parsing', () => {
  const sql = `
    CREATE TABLE "task comments" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      [author name] TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
      loose_column,
      created_at TEXT DEFAULT (datetime('now'))
    ) STRICT;`;
  const result = parseSql(sql, 'sqlite');
  const table = result.schema.tables[0];

  it('parses quoted table names, bracket identifiers and typeless columns', () => {
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(table.name).toBe('task comments');
    expect(col(table, 'author name').nullable).toBe(false);
    expect(col(table, 'loose_column').sqlType).toBe('');
    expect(col(table, 'created_at').defaultValue).toBe("(datetime('now'))");
  });

  it('extracts CHECK (... IN ...) as enum values', () => {
    expect(col(table, 'status').enumValues).toEqual(['todo', 'done']);
  });

  it('marks INTEGER PRIMARY KEY AUTOINCREMENT', () => {
    expect(col(table, 'id').primaryKey).toBe(true);
    expect(col(table, 'id').autoIncrement).toBe(true);
  });
});

describe('T-SQL parsing', () => {
  const sql = `
    CREATE TABLE [dbo].[Users] (
      [UserId] INT IDENTITY(1,1) NOT NULL,
      [Email] NVARCHAR(256) NOT NULL,
      [ExternalId] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
      [IsActive] BIT NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT ((1)),
      [Notes] NVARCHAR(MAX) NULL,
      [CreatedAt] DATETIME2(7) NOT NULL,
      [Total] AS ([UserId] * 2) PERSISTED,
      CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserId] ASC) WITH (PAD_INDEX = OFF) ON [PRIMARY]
    ) ON [PRIMARY]
    GO
    CREATE TABLE dbo.Roles ([RoleId] INT NOT NULL PRIMARY KEY, [Name] [nvarchar](50) NOT NULL)
    GO`;
  const result = parseSql(sql, 'tsql');

  it('parses bracket identifiers, GO separators and computed columns', () => {
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.schema.tables.map((t) => t.name)).toEqual(['Users', 'Roles']);
    const users = result.schema.tables[0];
    expect(users.schema).toBe('dbo');
    expect(col(users, 'UserId').autoIncrement).toBe(true);
    expect(col(users, 'UserId').primaryKey).toBe(true);
    expect(col(users, 'IsActive').sqlType).toBe('BOOLEAN');
    expect(col(users, 'IsActive').defaultValue).toBe('((1))');
    expect(col(users, 'Notes').typeParams).toEqual(['MAX']);
    expect(col(users, 'CreatedAt').sqlType).toBe('DATETIME');
    expect(col(users, 'Total').generated).toBe(true);
  });

  it('parses bracketed type names', () => {
    const roles = result.schema.tables[1];
    expect(col(roles, 'Name').sqlType).toBe('NVARCHAR');
    expect(col(roles, 'Name').typeParams).toEqual(['50']);
  });
});

describe('general parsing behaviour', () => {
  it('parses multiple tables with comments and different casing', () => {
    const result = parseSql(
      `/* first */
       create table a (id int primary key); -- trailing
       CREATE TABLE B (
         -- the identifier
         ID INT NOT NULL,
         Name Text -- display name
       );
       Create Table c (x int);`,
      'postgresql',
    );
    expect(result.schema.tables.map((t) => t.name)).toEqual(['a', 'B', 'c']);
    const b = result.schema.tables[1];
    expect(col(b, 'ID').comment).toBe('the identifier');
    expect(col(b, 'Name').comment).toBe('display name');
  });

  it('detects nullability, primary keys, unique and composite keys', () => {
    const result = parseSql(
      `CREATE TABLE memberships (
         org_id INT NOT NULL,
         user_id INT NOT NULL,
         nickname TEXT NULL,
         code TEXT,
         PRIMARY KEY (org_id, user_id),
         UNIQUE (code),
         UNIQUE (org_id, nickname)
       );`,
      'postgresql',
    );
    const t = result.schema.tables[0];
    expect(t.primaryKey).toEqual(['org_id', 'user_id']);
    expect(col(t, 'org_id').primaryKey).toBe(true);
    expect(col(t, 'user_id').primaryKey).toBe(true);
    expect(col(t, 'nickname').nullable).toBe(true);
    expect(col(t, 'org_id').nullable).toBe(false);
    expect(col(t, 'code').unique).toBe(true);
    expect(col(t, 'nickname').unique).toBe(false);
    expect(t.uniqueConstraints).toEqual([['code'], ['org_id', 'nickname']]);
  });

  it('warns about (but tolerates) trailing commas', () => {
    const result = parseSql('CREATE TABLE t (id INT, name TEXT,);', 'postgresql');
    expect(result.schema.tables[0].columns).toHaveLength(2);
    expect(result.issues.some((i) => i.severity === 'warning' && /Trailing comma/.test(i.message))).toBe(true);
  });

  it('handles reserved words and unusual identifiers', () => {
    const result = parseSql('CREATE TABLE "order" ("select" INT, "user-name" TEXT, "from" TEXT);', 'postgresql');
    expect(result.schema.tables[0].name).toBe('order');
    expect(result.schema.tables[0].columns.map((c) => c.name)).toEqual(['select', 'user-name', 'from']);
  });

  it('parses all presets without errors', () => {
    for (const preset of PRESETS) {
      const result = parseSql(preset.sql, preset.dialect);
      expect(result.issues.filter((i) => i.severity === 'error'), preset.id).toEqual([]);
      expect(result.schema.tables.length, preset.id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('malformed SQL', () => {
  it('reports a missing table name', () => {
    const errs = errors('CREATE TABLE (id INT);');
    expect(errs[0].message).toBe('Could not determine table name');
    expect(errs[0].line).toBe(1);
  });

  it('reports unterminated strings with a location', () => {
    const errs = errors("CREATE TABLE t (\n  name TEXT DEFAULT 'oops\n);");
    expect(errs[0].message).toBe('Unterminated string literal');
    expect(errs[0].line).toBe(2);
    expect(errs[0].suggestion).toBeTruthy();
  });

  it('suggests a missing comma and keeps the other columns', () => {
    const result = parseSql('CREATE TABLE t (\n  id INT NOT NULL\n  email TEXT,\n  name TEXT\n);', 'postgresql');
    const err = result.issues.find((i) => i.severity === 'error');
    expect(err?.message).toMatch(/Unexpected token `email`/);
    expect(err?.line).toBe(3);
    expect(err?.suggestion).toMatch(/comma/);
    expect(result.schema.tables[0].columns.map((c) => c.name)).toEqual(['id', 'email', 'name']);
    expect(result.schema.tables[0].columns[1].sqlType).toBe('TEXT');
  });

  it('counts array dimensions', () => {
    const [table] = parseSql('CREATE TABLE t (a int[], b text[][], c int ARRAY);', 'postgresql').schema.tables;
    expect(table.columns.map((c) => c.arrayDimensions)).toEqual([1, 2, 1]);
  });

  it('reports a missing closing parenthesis without swallowing later tables', () => {
    const result = parseSql('CREATE TABLE a (id INT, name TEXT;\nCREATE TABLE b (id INT);', 'postgresql');
    expect(result.issues.some((i) => i.severity === 'error' && /Missing closing/.test(i.message))).toBe(true);
    expect(result.schema.tables.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('reports when no CREATE TABLE statement exists', () => {
    const errs = errors('SELECT 1;');
    expect(errs[0].message).toBe('No CREATE TABLE statements found');
  });

  it('never throws on garbage input', () => {
    for (const garbage of ['(((', ')))', 'CREATE', 'CREATE TABLE', 'CREATE TABLE x (', '`unterminated', '/* never closed', 'CREATE TABLE t (a INT DEFAULT);', '🙂🙂🙂']) {
      expect(() => parseSql(garbage, 'mysql')).not.toThrow();
      expect(() => parseSql(garbage, 'postgresql')).not.toThrow();
    }
  });

  it('flags unexpected tokens near CREATE when a semicolon is missing', () => {
    const result = parseSql('CREATE TABLE a (id INT)\nCREATE TABLE b (id INT);', 'postgresql');
    expect(result.schema.tables).toHaveLength(2);
    expect(result.issues.some((i) => /Missing semicolon before `CREATE`/.test(i.message))).toBe(true);
  });
});

describe('dialect detection', () => {
  it('recognises each preset dialect', () => {
    for (const preset of PRESETS) {
      expect(detectDialect(preset.sql)?.dialect, preset.id).toBe(preset.dialect);
    }
  });
});
