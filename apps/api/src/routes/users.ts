import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function userRoutes(app: FastifyInstance) {
  app.get("/users/me", { preHandler: requireUser }, async (req, reply) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.userId as string))
      .limit(1);
    return reply.send({ user });
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
    const rows = await db
      .select()
      .from(schema.attendance)
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
