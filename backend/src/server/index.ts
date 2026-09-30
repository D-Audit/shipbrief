import { createApp } from "../app/create-app.js";
import { config, placeholderSenderDomain } from "../config/env.js";
import { logger } from "../config/logger.js";
import { pool } from "../database/client.js";
import { startWorker } from "../workers/runner.js";

const app = createApp();
// Express 5 calls this callback with the error when binding fails (e.g. the port is taken),
// so check it rather than reporting "listening" from a process that isn't.
const server = app.listen(config.PORT, (error?: Error) => {
  if (error) {
    const inUse = (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    logger.fatal({ err: error, port: config.PORT }, inUse ? `Port ${config.PORT} is already in use — stop the other API process first` : "API failed to start");
    process.exit(1);
  }
  logger.info({ port: config.PORT, ai: config.aiProvider, email: config.emailProvider, worker: config.WORKER_MODE }, "ShipBrief API listening");
});

if (config.emailProvider === "resend" && placeholderSenderDomain(config.EMAIL_FROM)) {
  logger.warn(
    { emailFrom: config.EMAIL_FROM },
    "EMAIL_FROM uses a placeholder domain, so Resend will reject every email. Set it to an address on a domain verified at resend.com/domains (or ShipBrief <onboarding@resend.dev> for testing).",
  );
}

// In development the worker runs inside the API process; in production run `npm run start:worker` separately.
const worker = config.WORKER_MODE === "embedded" ? startWorker({ id: "embedded" }) : null;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  const forceExit = setTimeout(() => process.exit(1), 15_000);
  forceExit.unref();
  server.close();
  await worker?.stop();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "Unhandled promise rejection"));
