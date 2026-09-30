import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { pool } from "../database/client.js";
import { startWorker } from "./runner.js";

/** Standalone worker process for production (`npm run start:worker`). */
const worker = startWorker({ id: "standalone", concurrency: config.WORKER_CONCURRENCY });
logger.info({ env: config.NODE_ENV }, "ShipBrief worker running");

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  await worker.stop();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
