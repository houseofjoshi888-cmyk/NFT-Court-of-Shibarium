import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { D1Database, D1PreparedStatement } from "./marketplace-index";

// D1-compatible adapter for a durable Node server or local development. Serverless
// deployments must use a persistent database binding, not an ephemeral /tmp file.
export function createLocalMarketplaceDb(filename: string): D1Database {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  class Statement implements D1PreparedStatement {
    constructor(readonly sql: string, readonly values: SQLInputValue[] = []) {}
    bind(...values: unknown[]) { return new Statement(this.sql, values as SQLInputValue[]); }
    async first<T>() { return (db.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  }
  return {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: D1PreparedStatement[]) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map(statement => {
          const { sql, values } = statement as Statement;
          const prepared = db.prepare(sql);
          return { results: prepared.columns().length ? prepared.all(...values) : (prepared.run(...values), []) };
        });
        db.exec("COMMIT");
        return result;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}
