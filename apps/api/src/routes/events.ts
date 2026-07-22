import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { aggregateEvent } from "../aggregation/index.js";
import { requireAdmin } from "../auth.js";
import { db, schema } from "../db/client.js";

const eventParams = z.object({ id: z.string().uuid() });
const setParams = z.object({ id: z.string().uuid(), setId: z.string().uuid() });

const listQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  artist: z.string().uuid().optional(),
  venue: z.string().uuid().optional(),
  city: z.string().optional(),
  status: z.enum(["upcoming", "past"]).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const eventBody = z.object({
  name: z.string().min(1),
  venueId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
});

const setBody = z.object({
  isHeadliner: z.boolean().optional().default(false),
  position: z.number().int().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  artists: z
    .array(z.object({ artistId: z.string().uuid(), role: z.string().default("primary") }))
    .default([]),
});

export function eventRoutes(app: FastifyInstance) {
  app.get("/events", async (req, reply) => {
    const q = listQuery.parse(req.query);
    const now = new Date();
    const conds = [] as any[];
    if (q.from) conds.push(gte(schema.events.startsAt, q.from));
    if (q.to) conds.push(lte(schema.events.startsAt, q.to));
    if (q.venue) conds.push(eq(schema.events.venueId, q.venue));
    if (q.status === "upcoming") conds.push(gte(schema.events.startsAt, now));
    if (q.status === "past") conds.push(lte(schema.events.startsAt, now));
    if (q.q) conds.push(ilike(schema.events.name, `%${q.q}%`));
    if (q.city) {
      conds.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.venues)
            .where(and(eq(schema.venues.id, schema.events.venueId), ilike(schema.venues.city, q.city))),
        ),
      );
    }
    if (q.artist) {
      conds.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.sets)
            .innerJoin(schema.setArtists, eq(schema.setArtists.setId, schema.sets.id))
            .where(
              and(
                eq(schema.sets.eventId, schema.events.id),
                eq(schema.setArtists.artistId, q.artist),
              ),
            ),
        ),
      );
    }
    const rows = await db
      .select()
      .from(schema.events)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(q.status === "past" ? desc(schema.events.startsAt) : asc(schema.events.startsAt))
      .limit(q.limit);
    return reply.send({ events: rows });
  });

  app.get("/events/:id", async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);

    const [event] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);
    if (!event) return reply.code(404).send({ error: "event not found" });

    const [venue] = await db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, event.venueId))
      .limit(1);

    const setRows = await db
      .select()
      .from(schema.sets)
      .where(eq(schema.sets.eventId, eventId));

    const setIds = setRows.map((s) => s.id);
    const setArtistRows =
      setIds.length === 0
        ? []
        : await db
            .select({
              setId: schema.setArtists.setId,
              role: schema.setArtists.role,
              artistId: schema.artists.id,
              artistName: schema.artists.name,
            })
            .from(schema.setArtists)
            .innerJoin(schema.artists, eq(schema.artists.id, schema.setArtists.artistId))
            .where(inArray(schema.setArtists.setId, setIds));

    const reviewRows = await db
      .select({
        music: schema.reviews.music,
        crowd: schema.reviews.crowd,
        production: schema.reviews.production,
        venue: schema.reviews.venue,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.eventId, eventId));

    const aggregate = aggregateEvent(reviewRows);

    const sets = setRows.map((s) => ({
      id: s.id,
      isHeadliner: s.isHeadliner,
      position: s.position,
      startsAt: s.startsAt,
      artists: setArtistRows
        .filter((sa) => sa.setId === s.id)
        .map((sa) => ({ id: sa.artistId, name: sa.artistName, role: sa.role })),
    }));

    return reply.send({
      event: {
        id: event.id,
        name: event.name,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venue: venue ?? null,
      },
      sets,
      aggregate,
    });
  });

  app.get("/events/:id/sets", async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const setRows = await db
      .select()
      .from(schema.sets)
      .where(eq(schema.sets.eventId, eventId))
      .orderBy(asc(schema.sets.position));
    const setIds = setRows.map((s) => s.id);
    const artistRows =
      setIds.length === 0
        ? []
        : await db
            .select({
              setId: schema.setArtists.setId,
              role: schema.setArtists.role,
              artistId: schema.artists.id,
              artistName: schema.artists.name,
            })
            .from(schema.setArtists)
            .innerJoin(schema.artists, eq(schema.artists.id, schema.setArtists.artistId))
            .where(inArray(schema.setArtists.setId, setIds));
    const sets = setRows.map((s) => ({
      ...s,
      artists: artistRows
        .filter((r) => r.setId === s.id)
        .map((r) => ({ id: r.artistId, name: r.artistName, role: r.role })),
    }));
    return reply.send({ sets });
  });

  app.post("/events", { preHandler: requireAdmin }, async (req, reply) => {
    const body = eventBody.parse(req.body);
    const [row] = await db.insert(schema.events).values(body).returning();
    return reply.code(201).send({ event: row });
  });

  app.patch("/events/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = eventParams.parse(req.params);
    const patch = eventBody.partial().parse(req.body);
    const [row] = await db
      .update(schema.events)
      .set(patch)
      .where(eq(schema.events.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "event not found" });
    return reply.send({ event: row });
  });

  app.delete("/events/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = eventParams.parse(req.params);
    await db.delete(schema.events).where(eq(schema.events.id, id));
    return reply.code(204).send();
  });

  // Sets under an event: admin catalog CRUD.
  app.post("/events/:id/sets", { preHandler: requireAdmin }, async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const body = setBody.parse(req.body);
    try {
      const created = await db.transaction(async (tx) => {
        const [set] = await tx
          .insert(schema.sets)
          .values({
            eventId,
            isHeadliner: body.isHeadliner,
            position: body.position,
            startsAt: body.startsAt ?? null,
          })
          .returning();
        if (body.artists.length > 0) {
          await tx
            .insert(schema.setArtists)
            .values(body.artists.map((a) => ({ setId: set!.id, ...a })));
        }
        return set;
      });
      return reply.code(201).send({ set: created });
    } catch (err) {
      req.log.error({ err }, "set create failed");
      return reply.code(400).send({ error: "set create failed" });
    }
  });

  app.patch("/events/:id/sets/:setId", { preHandler: requireAdmin }, async (req, reply) => {
    const { id: eventId, setId } = setParams.parse(req.params);
    const patch = setBody.partial().parse(req.body);
    const { artists, ...setPatch } = patch;
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.sets)
        .set(setPatch)
        .where(and(eq(schema.sets.id, setId), eq(schema.sets.eventId, eventId)))
        .returning();
      if (!row) return null;
      if (artists) {
        await tx.delete(schema.setArtists).where(eq(schema.setArtists.setId, setId));
        if (artists.length > 0) {
          await tx
            .insert(schema.setArtists)
            .values(artists.map((a) => ({ setId, ...a })));
        }
      }
      return row;
    });
    if (!result) return reply.code(404).send({ error: "set not found" });
    return reply.send({ set: result });
  });

  app.delete("/events/:id/sets/:setId", { preHandler: requireAdmin }, async (req, reply) => {
    const { id: eventId, setId } = setParams.parse(req.params);
    await db
      .delete(schema.sets)
      .where(and(eq(schema.sets.id, setId), eq(schema.sets.eventId, eventId)));
    return reply.code(204).send();
  });
}
