import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const eventParams = z.object({ id: z.string().uuid() });

export function attendanceRoutes(app: FastifyInstance) {
  app.post("/events/:id/attendance", { preHandler: requireUser }, async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const userId = req.userId as string;

    const [event] = await db
      .select({ id: schema.events.id, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);
    if (!event) return reply.code(404).send({ error: "event not found" });

    // Attendance can't be claimed for a night that hasn't happened (RR-25).
    if (event.startsAt > new Date()) {
      return reply.code(422).send({ error: "event has not happened yet" });
    }

    // Idempotent upsert on (user, event).
    await db
      .insert(schema.attendance)
      .values({ userId, eventId })
      .onConflictDoNothing({ target: [schema.attendance.userId, schema.attendance.eventId] });

    return reply.code(201).send({ ok: true });
  });

  app.delete("/events/:id/attendance", { preHandler: requireUser }, async (req, reply) => {
    const { id: eventId } = eventParams.parse(req.params);
    const userId = req.userId as string;

    await db
      .delete(schema.attendance)
      .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.eventId, eventId)));

    return reply.code(204).send();
  });
}
