import { asc, desc, eq, ilike, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { aggregateArtist, aggregateEvent } from "../aggregation/index.js";
import { requireAdmin } from "../auth.js";
import { db, schema } from "../db/client.js";

const artistParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const artistBody = z.object({
  name: z.string().min(1),
  canonicalName: z.string().min(1),
});

export function artistRoutes(app: FastifyInstance) {
  app.get("/artists", async (req, reply) => {
    const q = listQuery.parse(req.query);
    const rows = await db
      .select()
      .from(schema.artists)
      .where(q.q ? ilike(schema.artists.name, `%${q.q}%`) : undefined)
      .orderBy(asc(schema.artists.canonicalName))
      .limit(q.limit);
    return reply.send({ artists: rows });
  });

  app.get("/artists/:id", async (req, reply) => {
    const { id: artistId } = artistParams.parse(req.params);

    const [artist] = await db
      .select()
      .from(schema.artists)
      .where(eq(schema.artists.id, artistId))
      .limit(1);
    if (!artist) return reply.code(404).send({ error: "artist not found" });

    // Sets this artist played, with the events they belong to.
    const setJoins = await db
      .select({
        setId: schema.sets.id,
        isHeadliner: schema.sets.isHeadliner,
        eventId: schema.sets.eventId,
      })
      .from(schema.setArtists)
      .innerJoin(schema.sets, eq(schema.sets.id, schema.setArtists.setId))
      .where(eq(schema.setArtists.artistId, artistId));

    const headlinedEventIds = Array.from(
      new Set(setJoins.filter((s) => s.isHeadliner).map((s) => s.eventId)),
    );
    const artistSetIds = setJoins.map((s) => s.setId);

    const headlinedInputs = [] as Parameters<typeof aggregateArtist>[0];
    if (headlinedEventIds.length > 0) {
      const reviewRows = await db
        .select({
          eventId: schema.reviews.eventId,
          music: schema.reviews.music,
          crowd: schema.reviews.crowd,
          production: schema.reviews.production,
          venue: schema.reviews.venue,
        })
        .from(schema.reviews)
        .where(inArray(schema.reviews.eventId, headlinedEventIds));

      const byEvent = new Map<string, typeof reviewRows>();
      for (const r of reviewRows) {
        const list = byEvent.get(r.eventId) ?? [];
        list.push(r);
        byEvent.set(r.eventId, list);
      }
      for (const eventId of headlinedEventIds) {
        const agg = aggregateEvent(byEvent.get(eventId) ?? []);
        headlinedInputs.push({
          eventMusic: agg.dimensions.music,
          eventCrowd: agg.dimensions.crowd,
          eventProduction: agg.dimensions.production,
        });
      }
    }

    let setRatings: number[] = [];
    if (artistSetIds.length > 0) {
      const rows = await db
        .select({ score: schema.setRatings.score })
        .from(schema.setRatings)
        .where(inArray(schema.setRatings.setId, artistSetIds));
      setRatings = rows.map((r) => r.score);
    }

    const score = aggregateArtist(headlinedInputs, setRatings);

    return reply.send({
      artist: { id: artist.id, name: artist.name, canonicalName: artist.canonicalName },
      score,
    });
  });

  app.get("/artists/:id/sets", async (req, reply) => {
    const { id: artistId } = artistParams.parse(req.params);
    const { limit } = listQuery.parse(req.query);
    const rows = await db
      .select({
        setId: schema.sets.id,
        isHeadliner: schema.sets.isHeadliner,
        role: schema.setArtists.role,
        eventId: schema.events.id,
        eventName: schema.events.name,
        startsAt: schema.events.startsAt,
      })
      .from(schema.setArtists)
      .innerJoin(schema.sets, eq(schema.sets.id, schema.setArtists.setId))
      .innerJoin(schema.events, eq(schema.events.id, schema.sets.eventId))
      .where(eq(schema.setArtists.artistId, artistId))
      .orderBy(desc(schema.events.startsAt))
      .limit(limit);
    return reply.send({ sets: rows });
  });

  app.post("/artists", { preHandler: requireAdmin }, async (req, reply) => {
    const body = artistBody.parse(req.body);
    const [row] = await db.insert(schema.artists).values(body).returning();
    return reply.code(201).send({ artist: row });
  });

  app.patch("/artists/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = artistParams.parse(req.params);
    const patch = artistBody.partial().parse(req.body);
    const [row] = await db
      .update(schema.artists)
      .set(patch)
      .where(eq(schema.artists.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "artist not found" });
    return reply.send({ artist: row });
  });

  app.delete("/artists/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = artistParams.parse(req.params);
    await db.delete(schema.artists).where(eq(schema.artists.id, id));
    return reply.code(204).send();
  });
}

