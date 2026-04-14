import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";

declare global {
  // eslint-disable-next-line no-var
  var __cafix_sql__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __cafix_db__:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined;
}

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "";

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Set DIRECT_URL or DATABASE_URL."
  );
}

/**
 * IMPORTANT:
 * - Production must ALWAYS use PostgreSQL.
 * - No SQLite fallback here.
 * - This fixes Vercel runtime issues like:
 *   'unable to open database file'
 */
const sql =
  global.__cafix_sql__ ||
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });

const db =
  global.__cafix_db__ ||
  drizzle(sql, {
    schema,
    logger: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__cafix_sql__ = sql;
  global.__cafix_db__ = db;
}

export { sql, db };

export function getDb() {
  return db;
}

export default db;
