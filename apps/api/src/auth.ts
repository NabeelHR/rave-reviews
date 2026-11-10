import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { readSessionCookie } from "./cookies.js";
import { db, schema } from "./db/client.js";

// RR-3 auth: passwordless magic-link login backed by server-side sessions.
// Identity is proven by a session cookie. During the RR-3 transition the legacy
// X-User-Id / X-Admin headers are still accepted by the middleware below; those
// shims are removed in RR-3c once the frontend uses cookies.
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

// ---------- Admin allowlist ----------

// Comma-separated user UUIDs in ADMIN_IDS. Server-side only — the client can no
// longer grant itself admin. Read per-call so it works regardless of when the
// env is loaded (and so tests can set it freely).
export function isAdmin(userId: string): boolean {
  const ids = (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

// ---------- Magic-link tokens ----------

// Mint a single-use token for a user. Returns the RAW token (goes in the email);
// only its hash is stored.
export async function createLoginToken(userId: string): Promise<string> {
  const token = newToken();
  await db.insert(schema.loginTokens).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
  });
  return token;
}

// Validate and burn a login token. Returns the userId on success, else null.
export async function consumeLoginToken(rawToken: string): Promise<string | null> {
  const hash = sha256(rawToken);
  const [row] = await db
    .select()
    .from(schema.loginTokens)
    .where(
      and(
        eq(schema.loginTokens.tokenHash, hash),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  // Mark used (single-use). The WHERE on usedAt makes a double-spend a no-op.
  const updated = await db
    .update(schema.loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.loginTokens.id, row.id), isNull(schema.loginTokens.usedAt)))
    .returning({ id: schema.loginTokens.id });
  if (updated.length === 0) return null; // lost the race — already consumed
  return row.userId;
}

// ---------- Sessions ----------

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await db.insert(schema.sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(rawToken: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(rawToken)));
}

async function userIdForToken(rawToken: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: schema.sessions.userId })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.tokenHash, sha256(rawToken)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.userId ?? null;
}

// Resolve the current user from the session cookie (null if unauthenticated).
export async function currentUserId(req: FastifyRequest): Promise<string | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  return userIdForToken(token);
}

// ---------- Middleware ----------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Transition shim: prefer the session cookie; fall back to the legacy X-User-Id
// header while the frontend migrates to cookie auth. The header path (and this
// helper) is removed in RR-3c. The UUID guard avoids the raw header hitting a
// uuid column and 500-ing (RR-11).
async function resolveUserId(req: FastifyRequest): Promise<string | null> {
  const fromSession = await currentUserId(req);
  if (fromSession) return fromSession;

  const header = req.headers["x-user-id"];
  const headerId = Array.isArray(header) ? header[0] : header;
  if (!headerId || !UUID_RE.test(headerId)) return null;
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, headerId))
    .limit(1);
  return row ? headerId : null;
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "authentication required" });
  req.userId = userId;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "authentication required" });
  // Admin via the ADMIN_IDS allowlist, or the legacy X-Admin header during the
  // transition (removed in RR-3c).
  const h = req.headers["x-admin"];
  const legacyAdmin = (Array.isArray(h) ? h[0] : h) === "true";
  if (!isAdmin(userId) && !legacyAdmin) {
    return reply.code(403).send({ error: "admin required" });
  }
  req.userId = userId;
}
