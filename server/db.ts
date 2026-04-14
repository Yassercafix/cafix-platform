import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../drizzle/schema.js";

const { Pool } = pg;

// Connection string handling
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
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000,
});

export const db = drizzle(pool, {
  schema,
  logger: false,
});

export async function getDb() {
  // Ensure the pool is ready
  try {
    // Simple query to test connection if needed, but for now just return the db instance
    // drizzle-orm/node-postgres with Pool handles lazy connection
    return db;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    throw err;
  }
}

export default db;
