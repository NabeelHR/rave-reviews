import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isAdmin, requireAdmin, requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Invite-only provisioning: an admin creates the account, the user then logs in
// via magic link. Email is stored lowercased to match the case-insensitive
// login lookup (see auth request-link).
const createUserBody = z.object({
  username: z.string().min(1).max(64),
  email: z.string().email(),
});

export function userRoutes(app: FastifyInstance) {
  // Admin-only: provision a user so they can magic-link in (RR-14). This is the
  // only way to add an account — signup was removed with RR-3c (invite-only).
  app.post("/users", { preHandler: requireAdmin }, async (req, reply) => {
    const body = createUserBody.parse(req.body);
    try {
      const [row] = await db
        .insert(schema.users)
        .values({ username: body.username, email: body.email.toLowerCase() })
        .returning({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          createdAt: schema.users.createdAt,
        });
      return reply.code(201).send({ user: row });
    } catch (err) {
      // username/email are unique — a clash is the expected conflict, not a 500.
      req.log.warn({ err }, "create user conflict");
      return reply.code(409).send({ error: "username or email already taken" });
    }
  });

  app.get("/users/me", { preHandler: requireUser }, async (req, reply) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.userId as string))
      .limit(1);
    if (!user) return reply.code(401).send({ error: "authentication required" });
    return reply.send({ user: { ...user, isAdmin: isAdmin(user.id) } });
  });

  app.get("/users/me/reviews", { preHandler: requireUser }, async (req, reply) => {
    const { limit } = listQuery.parse(req.query);
    const rows = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.userId, req.userId as string))
      .orderBy(desc(schema.reviews.updatedAt))
      .limit(limit);
    return reply.send({ reviews: rows });
  });

  app.get("/users/me/attendance", { preHandler: requireUser }, async (req, reply) => {
    const { limit } = listQuery.parse(req.query);
    // Join the event so the client can show names/dates, not bare UUIDs.
    const rows = await db
      .select({
        id: schema.attendance.id,
        eventId: schema.attendance.eventId,
        createdAt: schema.attendance.createdAt,
        eventName: schema.events.name,
        eventStartsAt: schema.events.startsAt,
      })
      .from(schema.attendance)
      .innerJoin(schema.events, eq(schema.attendance.eventId, schema.events.id))
      .where(eq(schema.attendance.userId, req.userId as string))
      .orderBy(desc(schema.attendance.createdAt))
      .limit(limit);
    return reply.send({ attendance: rows });
  });

  app.get("/users/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const [user] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!user) return reply.code(404).send({ error: "user not found" });

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.reviews)
      .where(eq(schema.reviews.userId, id));

    return reply.send({ user, stats: { reviewCount: countRows[0]?.count ?? 0 } });
  });
}
