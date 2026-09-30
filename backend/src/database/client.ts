import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Hard ceiling for any single statement so a bad query can't pin a connection.
  statement_timeout: 30_000,
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Unexpected idle Postgres client error");
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = NodePgDatabase<typeof schema>;
/** Either the root database handle or an open transaction. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export { schema };
