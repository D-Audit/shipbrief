import dns from "node:dns/promises";
import net from "node:net";
import { config } from "../config/env.js";
import { badRequest } from "./errors.js";

/**
 * Webhook targets are user-supplied URLs the server will call, so they are a
 * classic SSRF vector. Targets must be http(s) and resolve only to public
 * addresses. Checked at creation and again immediately before each delivery
 * (DNS can change between the two).
 */

function isPrivateIPv4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIPv4(normalized.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(normalized);
}

export function isPrivateAddress(ip: string) {
  return net.isIPv4(ip) ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

export async function assertPublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw badRequest("INVALID_URL", "Enter a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw badRequest("INVALID_URL", "Webhook URLs must use http or https.");
  }
  if (config.isProduction && url.protocol !== "https:") {
    throw badRequest("INVALID_URL", "Webhook URLs must use https.");
  }
  if (url.username || url.password) {
    throw badRequest("INVALID_URL", "Webhook URLs cannot contain credentials.");
  }
  if (config.WEBHOOK_ALLOW_PRIVATE_TARGETS) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host)
    ? [host]
    : await dns
        .lookup(host, { all: true, verbatim: true })
        .then((results) => results.map((result) => result.address))
        .catch(() => {
          throw badRequest("INVALID_URL", "That webhook host could not be resolved.");
        });
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw badRequest("INVALID_URL", "Webhook URLs must point to a public internet address.");
  }
  return url;
}
