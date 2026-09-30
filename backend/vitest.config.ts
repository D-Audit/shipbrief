import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    // Test files share one database; run them one at a time for deterministic state.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql:///shipbrief_test?host=/var/run/postgresql",
      ENCRYPTION_KEY: "c2hpcGJyaWVmLXRlc3QtZW5jcnlwdGlvbi1rZXktMzI=",
      APP_URL: "http://localhost:3000",
      AI_PROVIDER: "dev",
      EMAIL_PROVIDER: "log",
      WORKER_MODE: "off",
      WEBHOOK_ALLOW_PRIVATE_TARGETS: "true",
      STORAGE_LOCAL_DIR: "./storage-test",
      LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? "silent",
      // Fake OAuth apps so the sign-in flows can run end to end against mocked provider responses.
      // GitLab, Linear and Jira stay unconfigured to cover the "not set up" paths.
      GOOGLE_CLIENT_ID: "test-google-client",
      GOOGLE_CLIENT_SECRET: "test-google-secret",
      GITHUB_CLIENT_ID: "test-github-client",
      GITHUB_CLIENT_SECRET: "test-github-secret",
    },
  },
});
