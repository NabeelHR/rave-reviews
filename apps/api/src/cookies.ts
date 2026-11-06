import type { FastifyReply, FastifyRequest } from "fastify";

// Minimal cookie handling — one session cookie, no dependency. Security rests on
// the cookie's high-entropy random value (hashed server-side), not on signing.

export const SESSION_COOKIE = "rr_session";

const isProd = process.env.NODE_ENV === "production";

export function setSessionCookie(reply: FastifyReply, token: string, maxAgeSeconds: number) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    // Secure would prevent the cookie being set over plain http in local dev.
    ...(isProd ? ["Secure"] : []),
  ];
  reply.header("set-cookie", parts.join("; "));
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.header(
    "set-cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`,
  );
}

export function readSessionCookie(req: FastifyRequest): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const pair of raw.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === SESSION_COOKIE) {
      return pair.slice(idx + 1).trim() || null;
    }
  }
  return null;
}
