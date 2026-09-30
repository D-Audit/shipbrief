import { sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db, pool } from "./client.js";
import { runMigrations } from "./migrate.js";

/** Drops every table and re-applies migrations. Refuses to run in production. */
async function reset() {
  if (config.isProduction) throw new Error("db:reset is disabled in production");
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await runMigrations();
}

reset()
  .then(() => logger.info("Database reset and migrated"))
  .catch((error: unknown) => {
    logger.error({ err: error }, "Reset failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
