import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const idParams = z.object({ id: z.string().uuid() });
const score = z.number().int().min(1).max(10);
const ratingBody = z.object({ score });

export function setRoutes(app: FastifyInstance) {
  app.get("/sets/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const [set] = await db.select().from(schema.sets).where(eq(schema.sets.id, id)).limit(1);
    if (!set) return reply.code(404).send({ error: "set not found" });

    const artistRows = await db
      .select({
        id: schema.artists.id,
        name: schema.artists.name,
        role: schema.setArtists.role,
      })
      .from(schema.setArtists)
      .innerJoin(schema.artists, eq(schema.artists.id, schema.setArtists.artistId))
      .where(eq(schema.setArtists.setId, id));

    const ratings = await db
      .select({ score: schema.setRatings.score })
      .from(schema.setRatings)
      .where(eq(schema.setRatings.setId, id));

    const avg = ratings.length
      ? ratings.reduce((a, r) => a + r.score, 0) / ratings.length
      : null;

    return reply.send({
      set,
      artists: artistRows,
      rating: { count: ratings.length, average: avg },
    });
  });

  // Set-rating writes: gated on attendance for the set's event.
  async function requireAttendance(userId: string, setId: string) {
    const [set] = await db
      .select({ eventId: schema.sets.eventId })
      .from(schema.sets)
      .where(eq(schema.sets.id, setId))
      .limit(1);
    if (!set) return { ok: false as const, code: 404, error: "set not found" };
    const att = await db
      .select({ id: schema.attendance.id })
      .from(schema.attendance)
      .where(
        and(eq(schema.attendance.userId, userId), eq(schema.attendance.eventId, set.eventId)),
      )
      .limit(1);
    if (att.length === 0)
      return { ok: false as const, code: 403, error: "attendance required" };
    return { ok: true as const };
  }

  app.post("/sets/:id/rating", { preHandler: requireUser }, async (req, reply) => {
    const { id: setId } = idParams.parse(req.params);
    const { score: value } = ratingBody.parse(req.body);
    const userId = req.userId as string;

    const gate = await requireAttendance(userId, setId);
    if (!gate.ok) return reply.code(gate.code).send({ error: gate.error });

    const [row] = await db
      .insert(schema.setRatings)
      .values({ userId, setId, score: value })
      .onConflictDoUpdate({
        target: [schema.setRatings.userId, schema.setRatings.setId],
        set: { score: value, updatedAt: new Date() },
      })
      .returning();
    return reply.code(201).send({ rating: row });
  });

  app.patch("/sets/:id/rating", { preHandler: requireUser }, async (req, reply) => {
    const { id: setId } = idParams.parse(req.params);
    const { score: value } = ratingBody.parse(req.body);
    const userId = req.userId as string;

    const [row] = await db
      .update(schema.setRatings)
      .set({ score: value, updatedAt: new Date() })
      .where(and(eq(schema.setRatings.userId, userId), eq(schema.setRatings.setId, setId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "rating not found" });
    return reply.send({ rating: row });
  });

  app.delete("/sets/:id/rating", { preHandler: requireUser }, async (req, reply) => {
    const { id: setId } = idParams.parse(req.params);
    const userId = req.userId as string;
    await db
      .delete(schema.setRatings)
      .where(and(eq(schema.setRatings.userId, userId), eq(schema.setRatings.setId, setId)));
    return reply.code(204).send();
  });
}

