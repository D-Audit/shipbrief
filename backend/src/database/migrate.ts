import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../config/logger.js";
import { db, pool } from "./client.js";

export const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => logger.info("Migrations applied"))
    .catch((error: unknown) => {
      logger.error({ err: error }, "Migration failed");
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
