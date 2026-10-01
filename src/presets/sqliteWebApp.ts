import type { SqlPreset } from './types';

export const sqliteWebApp: SqlPreset = {
  id: 'sqlite-webapp',
  label: 'SQLite Modern Web App',
  dialect: 'sqlite',
  description: 'Projects, tasks and comments with INTEGER PRIMARY KEY, CHECK enums and STRICT tables.',
  sql: `-- SQLite schema for a task-tracking web app
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  settings TEXT NOT NULL DEFAULT '{}', -- JSON encoded settings
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority INTEGER NOT NULL DEFAULT 2,
  estimate_hours REAL,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE TABLE "task comments" (
  "id" INTEGER PRIMARY KEY,
  "task_id" INTEGER NOT NULL,
  "author email" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("task_id") REFERENCES tasks ("id")
);

CREATE INDEX idx_tasks_project ON tasks (project_id);
`,
};
