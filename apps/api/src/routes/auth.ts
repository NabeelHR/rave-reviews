import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { db, schema } from "../db/client.js";

const signupBody = z.object({
  username: z.string().min(1).max(64),
  email: z.string().email(),
});

export function authRoutes(app: FastifyInstance) {
  // Real password/session auth lands in iteration 2 alongside the frontend.
  // Signup exists now because we need a way to mint user rows without the seed.
  app.post("/auth/signup", async (req, reply) => {
    const body = signupBody.parse(req.body);
    try {
      const [row] = await db.insert(schema.users).values(body).returning();
      return reply.code(201).send({ user: row });
    } catch (err) {
      req.log.warn({ err }, "signup conflict");
      return reply.code(409).send({ error: "username or email taken" });
    }
  });

  app.post("/auth/login", async (_req, reply) => {
    return reply.code(501).send({
      error: "not_implemented",
      note: "real auth in iteration 2; pass X-User-Id header for now",
    });
  });

  app.post("/auth/logout", { preHandler: requireUser }, async (_req, reply) => {
    return reply.code(204).send();
  });
}
