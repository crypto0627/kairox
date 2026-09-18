import "server-only";
import postgres from "postgres";

/**
 * The one database handle.
 *
 * Next's dev server re-evaluates modules on every hot reload, so a plain
 * module-level connection leaks a pool per edit until Postgres refuses new
 * clients. Parking it on globalThis is the standard escape hatch.
 */
const globalForDb = globalThis as unknown as { kairoxDb?: postgres.Sql };

function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Start the local database with `pnpm db:up`, " +
        "or point it at a hosted Postgres.",
    );
  }
  return postgres(url, {
    max: 4,
    idle_timeout: 20,
    // Neon and Supabase both terminate plaintext; a local container does not
    // offer TLS at all. `prefer` covers both without a second code path.
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "prefer",
  });
}

export const db: postgres.Sql = globalForDb.kairoxDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.kairoxDb = db;

/** True when a database is configured at all. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
