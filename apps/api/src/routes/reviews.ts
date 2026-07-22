import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const eventParams = z.object({ id: z.string().uuid() });
const reviewParams = z.object({ id: z.string().uuid() });

const score = z.number().int().min(1).max(10);

const reviewPatchBody = z.object({
  scores: z
    .object({
      music: score.optional(),
      crowd: score.optional(),
      production: score.nullable().optional(),
      venue: score.optional(),
    })
    .optional(),
  text: z.string().max(5000).nullable().optional(),
});

const reviewBody = z.object({
  scores: z.object({
    music: score,
    crowd: score,
    production: score.nullable(),
    venue: score,
  }),
  text: z.string().max(5000).optional(),
  setRatings: z
    .array(z.object({ setId: z.string().uuid(), score }))
    .optional()
    .default([]),
});

export function reviewRoutes(app: FastifyInstance) {
  app.post("/events/:id/reviews", { preHandler: requireUser }, async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const body = reviewBody.parse(req.body);
    const userId = req.userId as string;

    // Verify event exists (cheap; also caught by FK).
    const event = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);
    if (event.length === 0) return reply.code(404).send({ error: "event not found" });

    // If any set ratings are present, gate on attendance and validate set membership.
    if (body.setRatings.length > 0) {
      const att = await db
        .select({ id: schema.attendance.id })
        .from(schema.attendance)
        .where(
          and(eq(schema.attendance.userId, userId), eq(schema.attendance.eventId, eventId)),
        )
        .limit(1);
      if (att.length === 0) {
        return reply
          .code(403)
          .send({ error: "set ratings require attendance for this event" });
      }
      const setIds = body.setRatings.map((s) => s.setId);
      const setsInEvent = await db
        .select({ id: schema.sets.id })
        .from(schema.sets)
        .where(and(inArray(schema.sets.id, setIds), eq(schema.sets.eventId, eventId)));
      if (setsInEvent.length !== new Set(setIds).size) {
        return reply
          .code(400)
          .send({ error: "one or more setIds do not belong to this event" });
      }
    }

    // One transaction: upsert review + upsert set ratings. Attendance is *read* above,
    // not written here (see request-lifecycle.md).
    try {
      const created = await db.transaction(async (tx) => {
        const [reviewRow] = await tx
          .insert(schema.reviews)
          .values({
            userId,
            eventId,
            music: body.scores.music,
            crowd: body.scores.crowd,
            production: body.scores.production,
            venue: body.scores.venue,
            text: body.text ?? null,
          })
          .onConflictDoUpdate({
            target: [schema.reviews.userId, schema.reviews.eventId],
            set: {
              music: body.scores.music,
              crowd: body.scores.crowd,
              production: body.scores.production,
              venue: body.scores.venue,
              text: body.text ?? null,
              updatedAt: new Date(),
            },
          })
          .returning();

        for (const sr of body.setRatings) {
          await tx
            .insert(schema.setRatings)
            .values({ userId, setId: sr.setId, score: sr.score })
            .onConflictDoUpdate({
              target: [schema.setRatings.userId, schema.setRatings.setId],
              set: { score: sr.score, updatedAt: new Date() },
            });
        }

        // v1 aggregation seam: mark dirty is a no-op (compute-on-read).
        // In phase 2 the throttled recompute wakes here.
        return reviewRow;
      });

      return reply.code(201).send({ review: created });
    } catch (err) {
      req.log.error({ err }, "review write failed");
      return reply.code(500).send({ error: "write failed" });
    }
  });

  app.get("/events/:id/reviews", async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const rows = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.eventId, eventId));
    return reply.send({ reviews: rows });
  });

  app.get("/reviews/:id", async (req, reply) => {
    const { id } = reviewParams.parse(req.params);
    const [row] = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "review not found" });
    return reply.send({ review: row });
  });

  app.patch("/reviews/:id", { preHandler: requireUser }, async (req, reply) => {
    const { id } = reviewParams.parse(req.params);
    const patch = reviewPatchBody.parse(req.body);
    const userId = req.userId as string;

    const [existing] = await db
      .select({ userId: schema.reviews.userId })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .limit(1);
    if (!existing) return reply.code(404).send({ error: "review not found" });
    if (existing.userId !== userId) return reply.code(403).send({ error: "not owner" });

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.scores?.music !== undefined) set.music = patch.scores.music;
    if (patch.scores?.crowd !== undefined) set.crowd = patch.scores.crowd;
    if (patch.scores && "production" in patch.scores)
      set.production = patch.scores.production ?? null;
    if (patch.scores?.venue !== undefined) set.venue = patch.scores.venue;
    if (patch.text !== undefined) set.text = patch.text;

    const [row] = await db
      .update(schema.reviews)
      .set(set)
      .where(eq(schema.reviews.id, id))
      .returning();
    return reply.send({ review: row });
  });

  app.delete("/reviews/:id", { preHandler: requireUser }, async (req, reply) => {
    const { id } = reviewParams.parse(req.params);
    const userId = req.userId as string;
    const [existing] = await db
      .select({ userId: schema.reviews.userId })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .limit(1);
    if (!existing) return reply.code(404).send({ error: "review not found" });
    if (existing.userId !== userId) return reply.code(403).send({ error: "not owner" });
    await db.delete(schema.reviews).where(eq(schema.reviews.id, id));
    return reply.code(204).send();
  });
}
