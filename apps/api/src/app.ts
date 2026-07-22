import Fastify from "fastify";
import { ZodError } from "zod";
import { artistRoutes } from "./routes/artists.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { authRoutes } from "./routes/auth.js";
import { eventRoutes } from "./routes/events.js";
import { reviewRoutes } from "./routes/reviews.js";
import { setRoutes } from "./routes/sets.js";
import { userRoutes } from "./routes/users.js";
import { venueRoutes } from "./routes/venues.js";

export function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "validation_failed", details: err.flatten() });
    }
    reply.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: "internal_error" });
  });

  app.get("/health", async () => ({ ok: true }));

  authRoutes(app);
  userRoutes(app);
  venueRoutes(app);
  eventRoutes(app);
  artistRoutes(app);
  setRoutes(app);
  attendanceRoutes(app);
  reviewRoutes(app);

  return app;
}
