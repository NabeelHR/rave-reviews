import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  consumeLoginToken,
  createLoginToken,
  createSession,
  destroySession,
  isAdmin,
  requireUser,
  SESSION_MAX_AGE_SECONDS,
} from "../auth.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../cookies.js";
import { db, schema } from "../db/client.js";
import { sendEmail } from "../email.js";

const signupBody = z.object({
  username: z.string().min(1).max(64),
  email: z.string().email(),
});
const requestLinkBody = z.object({ email: z.string().email() });
const callbackBody = z.object({ token: z.string().min(1) });

// Where the magic link sends the user — the frontend callback route. The link must
// land on the app origin so the session cookie is scoped there (incl. via the dev proxy).
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

export function authRoutes(app: FastifyInstance) {
  // Kept during the RR-3 transition so the existing frontend keeps working.
  // Removed in RR-3c once magic-link login is the only path.
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

  // Passwordless login, step 1: request a magic link.
  // Invite-only — a link is only minted for an email that already has a user.
  // Always returns 200 so the endpoint can't be used to probe which emails exist.
  app.post("/auth/request-link", async (req, reply) => {
    const { email } = requestLinkBody.parse(req.body);

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (user) {
      const token = await createLoginToken(user.id);
      const link = `${appUrl}/auth/callback?token=${token}`;
      await sendEmail({
        to: email,
        subject: "Your Rave Reviews sign-in link",
        text: `Click to sign in (expires in 15 minutes):\n\n${link}\n\nIf you didn't request this, ignore it.`,
      });
    }

    return reply.send({ ok: true });
  });

  // Step 2: the frontend posts the token from the link; we start a session.
  app.post("/auth/callback", async (req, reply) => {
    const { token } = callbackBody.parse(req.body);
    const userId = await consumeLoginToken(token);
    if (!userId) {
      return reply.code(401).send({ error: "invalid or expired link" });
    }
    const sessionToken = await createSession(userId);
    setSessionCookie(reply, sessionToken, SESSION_MAX_AGE_SECONDS);

    const [user] = await db
      .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return reply.send({ user: { ...user, isAdmin: isAdmin(userId) } });
  });

  app.post("/auth/logout", { preHandler: requireUser }, async (req, reply) => {
    const token = readSessionCookie(req);
    if (token) await destroySession(token);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}
