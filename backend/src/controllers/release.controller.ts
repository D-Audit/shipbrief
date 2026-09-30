import type { Request, Response } from "express";
import * as releases from "../services/release.service.js";
import { actorOf, parse, sendData } from "../utils/http.js";
import { uuidParam } from "../validators/common.js";
import {
  createReleaseSchema,
  listReleasesQuery,
  requestChangesSchema,
  restoreVersionParams,
  scheduleSchema,
  updateReleaseSchema,
} from "../validators/releases.js";

export async function list(req: Request, res: Response) {
  const query = parse(req, "query", listReleasesQuery);
  const { items, total } = await releases.listReleases(actorOf(req), query);
  sendData(res, items, 200, { page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total });
}

export async function counts(req: Request, res: Response) {
  sendData(res, await releases.releaseCounts(actorOf(req)));
}

export async function get(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.getRelease(actorOf(req), id));
}

export async function create(req: Request, res: Response) {
  const body = parse(req, "body", createReleaseSchema);
  sendData(res, await releases.createRelease(actorOf(req), body), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const body = parse(req, "body", updateReleaseSchema);
  sendData(res, await releases.updateRelease(actorOf(req), id, body));
}

export async function duplicate(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.duplicateRelease(actorOf(req), id), 201);
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.deleteRelease(actorOf(req), id));
}

export async function submit(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.submitForReview(actorOf(req), id));
}

export async function approve(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.approveRelease(actorOf(req), id));
}

export async function requestChanges(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const { note } = parse(req, "body", requestChangesSchema);
  sendData(res, await releases.requestChanges(actorOf(req), id, note));
}

export async function schedule(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const { scheduledAt } = parse(req, "body", scheduleSchema);
  sendData(res, await releases.scheduleRelease(actorOf(req), id, scheduledAt));
}

export async function unschedule(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.unscheduleRelease(actorOf(req), id));
}

export async function publish(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.publishRelease(actorOf(req), id));
}

export async function archive(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.archiveRelease(actorOf(req), id));
}

export async function versions(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await releases.listVersions(actorOf(req), id));
}

export async function restoreVersion(req: Request, res: Response) {
  const { id, versionId } = parse(req, "params", restoreVersionParams);
  sendData(res, await releases.restoreVersion(actorOf(req), id, versionId));
}
