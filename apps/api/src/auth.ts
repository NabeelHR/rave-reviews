import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client.js";

// Iteration-1 auth stub: trust an X-User-Id header and resolve it to a user row.
// Real auth (NextAuth or similar) lands with the frontend in iteration 2.
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers["x-user-id"];
  const userId = Array.isArray(header) ? header[0] : header;
  if (!userId) {
    return reply.code(401).send({ error: "missing X-User-Id header" });
  }
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (rows.length === 0) {
    return reply.code(401).send({ error: "unknown user" });
  }
  req.userId = userId;
}

// Admin gate stub: real roles land with real auth in iteration 2.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers["x-admin"];
  const val = Array.isArray(header) ? header[0] : header;
  if (val !== "true") return reply.code(403).send({ error: "admin required" });
}
