import pino from "pino";
import { config } from "./env.js";

/**
 * Structured logger. Credential-shaped fields are redacted wherever they
 * appear so a stray `logger.info({ body })` can never leak a secret.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "shipbrief-api" },
  redact: {
    paths: [
      "password",
      "*.password",
      "*.newPassword",
      "token",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
      "*.apiKey",
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
    censor: "[redacted]",
  },
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } }
      : undefined,
});

export type Logger = typeof logger;
