import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { TRPCError } from "@trpc/server";

export async function validateWebhookTarget(input: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "invalid webhook url",
    });
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const protocolAllowed =
    url.protocol === "https:" ||
    (isDevelopment && url.protocol === "http:");

  if (!protocolAllowed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "webhook url must use https",
    });
  }

  if (url.username || url.password) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "webhook url must not embed credentials",
    });
  }

  if (url.port && Number(url.port) <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "invalid webhook port",
    });
  }

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname) && !isDevelopment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "webhook hostname is not allowed",
    });
  }

  if (!isDevelopment || !isLocalDevelopmentHost(hostname)) {
    const addresses = await resolveAddresses(hostname);
    if (addresses.some((address) => isPrivateAddress(address))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "webhook target must not resolve to a private address",
      });
    }
  }

  url.hash = "";
  return url.toString();
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  // WHATWG URL preserves the brackets on IPv6 hostnames (e.g. "[::1]").
  // Strip them so `isIP` can recognize the literal instead of treating it as
  // a DNS name and falling through to `lookup`, where it would be reported as
  // "hostname could not be resolved" and mask the real private-IP intent.
  const unbracketed =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  if (isIP(unbracketed)) return [unbracketed];

  try {
    const rows = await lookup(unbracketed, { all: true, verbatim: true });
    return rows.map((row) => row.address);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "webhook hostname could not be resolved",
    });
  }
}

function isBlockedHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  );
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(".")) {
    return isPrivateIpv4(address);
  }

  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }

  return false;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return true;
  }

  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
