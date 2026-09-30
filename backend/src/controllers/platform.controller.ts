import type { Request, Response } from "express";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import * as ai from "../services/ai.service.js";
import * as apiKeys from "../services/api-key.service.js";
import * as integrations from "../services/integration.service.js";
import * as migrations from "../services/migration.service.js";
import * as uploads from "../services/upload.service.js";
import * as webhooks from "../services/webhook.service.js";
import { badRequest } from "../utils/errors.js";
import { actorOf, parse, sendData } from "../utils/http.js";
import { uuidParam } from "../validators/common.js";
import { oauthCallbackQuery } from "../validators/auth.js";
import {
  aiGenerateReleaseSchema,
  aiQualitySchema,
  aiRewriteSchema,
  aiVariantSchema,
  createApiKeySchema,
  createWebhookSchema,
  deliveriesQuery,
  integrationUpdateSchema,
  migrationSchema,
  providerParam,
  syncSchema,
  updateWebhookSchema,
  uploadPurposeSchema,
} from "../validators/workspace.js";

// AI ---------------------------------------------------------------------------

export const aiGenerateRelease = async (req: Request, res: Response) => sendData(res, await ai.generateRelease(actorOf(req), parse(req, "body", aiGenerateReleaseSchema)));
export const aiRewrite = async (req: Request, res: Response) => sendData(res, await ai.rewrite(actorOf(req), parse(req, "body", aiRewriteSchema)));
export const aiChannelVariant = async (req: Request, res: Response) => sendData(res, await ai.generateChannelVariant(actorOf(req), parse(req, "body", aiVariantSchema)));
export const aiQualityCheck = async (req: Request, res: Response) => sendData(res, await ai.qualityCheck(actorOf(req), parse(req, "body", aiQualitySchema)));
export const aiClusterFeedback = async (req: Request, res: Response) => sendData(res, await ai.clusterFeedback(actorOf(req)));

// API keys & webhooks ----------------------------------------------------------

export const listApiKeys = async (req: Request, res: Response) => sendData(res, await apiKeys.listApiKeys(actorOf(req)));
export const createApiKey = async (req: Request, res: Response) => sendData(res, await apiKeys.createApiKey(actorOf(req), parse(req, "body", createApiKeySchema)), 201);

export async function revokeApiKey(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await apiKeys.revokeApiKey(actorOf(req), id));
}

export const listWebhooks = async (req: Request, res: Response) => sendData(res, await webhooks.listWebhooks(actorOf(req)));
export const createWebhook = async (req: Request, res: Response) => sendData(res, await webhooks.createWebhook(actorOf(req), parse(req, "body", createWebhookSchema)), 201);

export async function updateWebhook(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await webhooks.updateWebhook(actorOf(req), id, parse(req, "body", updateWebhookSchema)));
}

export async function removeWebhook(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await webhooks.removeWebhook(actorOf(req), id));
}

export async function rotateWebhookSecret(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await webhooks.rotateWebhookSecret(actorOf(req), id));
}

export async function testWebhook(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await webhooks.sendTestEvent(actorOf(req), id), 202);
}

export async function listDeliveries(req: Request, res: Response) {
  const { webhookId } = parse(req, "query", deliveriesQuery);
  sendData(res, await webhooks.listDeliveries(actorOf(req), webhookId));
}

export async function retryDelivery(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await webhooks.retryDelivery(actorOf(req), id), 202);
}

// Integrations -----------------------------------------------------------------

export const listIntegrations = async (req: Request, res: Response) => sendData(res, await integrations.listIntegrations(actorOf(req)));

export async function connectIntegration(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  sendData(res, await integrations.startConnect(actorOf(req), provider));
}

export async function integrationCallback(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  const query = parse(req, "query", oauthCallbackQuery);
  const back = `${config.APP_URL}/app/integrations`;
  if (query.error || !query.code || !query.state) return res.redirect(303, `${back}?connect=cancelled&provider=${provider}`);
  try {
    await integrations.completeConnect(provider, { code: query.code, state: query.state, userId: req.auth?.kind === "session" ? req.auth.user.id : null });
    res.redirect(303, `${back}?connect=success&provider=${provider}`);
  } catch (error) {
    logger.warn({ err: error, provider, requestId: req.id }, "Integration connection failed");
    res.redirect(303, `${back}?connect=failed&provider=${provider}`);
  }
}

export async function integrationTargets(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  sendData(res, await integrations.listTargets(actorOf(req), provider));
}

export async function disconnectIntegration(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  sendData(res, await integrations.disconnect(actorOf(req), provider));
}

export async function syncIntegration(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  const { since } = parse(req, "body", syncSchema);
  sendData(res, await integrations.sync(actorOf(req), provider, { since }));
}

export async function updateIntegration(req: Request, res: Response) {
  const { provider } = parse(req, "params", providerParam);
  sendData(res, await integrations.updateIntegration(actorOf(req), provider, parse(req, "body", integrationUpdateSchema)));
}

// Uploads & imports ------------------------------------------------------------

export async function upload(req: Request, res: Response) {
  const { purpose } = parse(req, "body", uploadPurposeSchema);
  if (!req.file) throw badRequest("NO_FILE", "Choose a file to upload.");
  sendData(res, await uploads.storeUpload(actorOf(req), { purpose, buffer: req.file.buffer, originalName: req.file.originalname }), 201);
}

export async function serveFile(req: Request, res: Response) {
  const { workspace, purpose, name } = req.params as Record<string, string>;
  const key = `${workspace}/${purpose}/${name}`;
  if (!/^[0-9a-f-]{36}\/(logo|favicon|media)\/[0-9a-f-]{36}\.(png|jpg|webp|gif|ico|svg)$/.test(key)) throw badRequest("INVALID_FILE", "File not found.");
  const file = await uploads.readPublicFile(key);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Even an SVG that slipped through validation can't run script under this policy.
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.send(file.body);
}

export const previewImport = async (req: Request, res: Response) => sendData(res, await migrations.previewImport(actorOf(req), parse(req, "body", migrationSchema)));
export const runImport = async (req: Request, res: Response) => sendData(res, await migrations.runImport(actorOf(req), parse(req, "body", migrationSchema)), 201);
