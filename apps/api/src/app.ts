import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
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

  // Health stays unversioned — it's an ops liveness probe, not part of the API.
  app.get("/health", async () => ({ ok: true }));

  // Everything else lives under /v1 so the surface can evolve without breaking
  // pinned clients. Registered inside a prefixed sub-instance in one sweep.
  app.register(
    async (v1) => {
      authRoutes(v1);
      userRoutes(v1);
      venueRoutes(v1);
      eventRoutes(v1);
      artistRoutes(v1);
      setRoutes(v1);
      attendanceRoutes(v1);
      reviewRoutes(v1);
    },
    { prefix: "/v1" },
  );

  // When SERVE_SPA=true the same server also serves the built React app, so the
  // whole thing is one origin (no CORS). In dev, Vite serves the SPA instead.
  // (Gated on its own flag, not NODE_ENV, so the deploy's build step still
  // installs devDependencies.)
  if (process.env.SERVE_SPA === "true") {
    const dist = fileURLToPath(new URL("../../web/dist", import.meta.url));
    app.register(fastifyStatic, { root: dist, wildcard: false });
    // SPA fallback: anything that isn't a real file or an API route returns
    // index.html so client-side routes (e.g. /events/:id, /auth/callback) work
    // on direct load. API misses still get a JSON 404.
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== "GET" || req.url.startsWith("/v1") || req.url.startsWith("/health")) {
        return reply.code(404).send({ error: "not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
