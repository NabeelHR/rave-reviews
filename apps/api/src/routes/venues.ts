import { and, asc, desc, eq, ilike } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { db, schema } from "../db/client.js";

const idParams = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  city: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const venueBody = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  region: z.string().optional(),
  country: z.string().min(2),
  lat: z.string().optional(),
  lng: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

// Note: `?near=lat,lng&radius=` is spec'd in api-surface.md but venues.lat/lng
// are text and there is no PostGIS in v1 — falling back to `?city=` string
// filter. Real geo filter is a follow-up.

export function venueRoutes(app: FastifyInstance) {
  app.get("/venues", async (req, reply) => {
    const q = listQuery.parse(req.query);
    const conds = [] as any[];
    if (q.city) conds.push(ilike(schema.venues.city, q.city));
    if (q.q) conds.push(ilike(schema.venues.name, `%${q.q}%`));
    const rows = await db
      .select()
      .from(schema.venues)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(schema.venues.name))
      .limit(q.limit);
    return reply.send({ venues: rows });
  });

  app.get("/venues/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const [venue] = await db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, id))
      .limit(1);
    if (!venue) return reply.code(404).send({ error: "venue not found" });
    return reply.send({ venue });
  });

  app.get("/venues/:id/events", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { limit } = listQuery.parse(req.query);
    const rows = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.venueId, id))
      .orderBy(desc(schema.events.startsAt))
      .limit(limit);
    return reply.send({ events: rows });
  });

  app.post("/venues", { preHandler: requireAdmin }, async (req, reply) => {
    const body = venueBody.parse(req.body);
    const [row] = await db.insert(schema.venues).values(body).returning();
    return reply.code(201).send({ venue: row });
  });

  app.patch("/venues/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const patch = venueBody.partial().parse(req.body);
    const [row] = await db
      .update(schema.venues)
      .set(patch)
      .where(eq(schema.venues.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "venue not found" });
    return reply.send({ venue: row });
  });

  app.delete("/venues/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await db.delete(schema.venues).where(eq(schema.venues.id, id));
    return reply.code(204).send();
  });
}
