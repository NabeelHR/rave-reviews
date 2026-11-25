import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  SESSION_MAX_AGE_SECONDS,
  consumeLoginToken,
  createLoginToken,
  createSession,
  destroySession,
  isAdmin,
  magicLinkUrl,
} from "../auth.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../cookies.js";
import { db, schema } from "../db/client.js";
import { sendEmail } from "../email.js";

const requestLinkBody = z.object({ email: z.string().email() });
const callbackBody = z.object({ token: z.string().min(1) });

export function authRoutes(app: FastifyInstance) {
  // Passwordless login, step 1: request a magic link.
  // Invite-only — a link is only minted for an email that already has a user.
  // Always returns 200 so the endpoint can't be used to probe which emails exist.
  app.post("/auth/request-link", async (req, reply) => {
    const { email } = requestLinkBody.parse(req.body);

    // Case-insensitive match on both sides — a user stored with mixed-case
    // email must still be able to log in (RR-3c lockout fix).
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${email.toLowerCase()}`)
      .limit(1);

    if (user) {
      const token = await createLoginToken(user.id);
      const link = magicLinkUrl(token);
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

  // No auth requirement: logout must work even with an expired/invalid session,
  // and the cookie is cleared unconditionally so the client never gets stuck.
  app.post("/auth/logout", async (req, reply) => {
    const token = readSessionCookie(req);
    if (token) await destroySession(token);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}
