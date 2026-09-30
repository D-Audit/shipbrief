import { execFileSync } from "node:child_process";

/** Recreates the test database schema once per run (in a child process, so the pool closes cleanly). */
export default function setup() {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql:///shipbrief_test?host=/var/run/postgresql",
    ENCRYPTION_KEY: "c2hpcGJyaWVmLXRlc3QtZW5jcnlwdGlvbi1rZXktMzI=",
    LOG_LEVEL: "silent",
  };
  execFileSync("npx", ["tsx", "src/database/reset.ts"], { env, stdio: "inherit" });
}
