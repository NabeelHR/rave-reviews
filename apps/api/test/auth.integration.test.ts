import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createLoginToken } from "../src/auth.js";
import { SESSION_COOKIE } from "../src/cookies.js";
import { db, schema, sqlClient } from "../src/db/client.js";

// Integration tests for RR-3 magic-link auth. Require Postgres + migrations.

let app: Awaited<ReturnType<typeof buildApp>>;

const adminId = "00000000-0000-0000-0000-0000000000a1";
const plainId = "00000000-0000-0000-0000-0000000000b2";

function cookieFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? "");
  return header.split(";")[0]!; // "rr_session=<token>"
}

beforeAll(async () => {
  process.env.ADMIN_IDS = adminId; // isAdmin reads env per-call
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await sqlClient.end();
});

beforeEach(async () => {
  // Wipe in FK-dependency order so leftover rows don't block the delete.
  await db.delete(schema.setRatings);
  await db.delete(schema.reviews);
  await db.delete(schema.attendance);
  await db.delete(schema.setArtists);
  await db.delete(schema.sets);
  await db.delete(schema.events);
  await db.delete(schema.venues);
  await db.delete(schema.users);
  await db.insert(schema.users).values([
    { id: adminId, username: "admin", email: "admin@x.io" },
    { id: plainId, username: "plain", email: "plain@x.io" },
  ]);
});

describe("POST /auth/request-link", () => {
  it("mints a token for a known email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/request-link",
      payload: { email: "admin@x.io" },
    });
    expect(res.statusCode).toBe(200);
    const tokens = await db.select().from(schema.loginTokens);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.userId).toBe(adminId);
  });

  it("returns 200 but mints nothing for an unknown email (invite-only, no leak)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/request-link",
      payload: { email: "stranger@x.io" },
    });
    expect(res.statusCode).toBe(200);
    const tokens = await db.select().from(schema.loginTokens);
    expect(tokens).toHaveLength(0);
  });
});

describe("POST /auth/callback", () => {
  it("exchanges a valid token for a session and is single-use", async () => {
    const token = await createLoginToken(plainId);

    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/callback",
      payload: { token },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().user.id).toBe(plainId);
    expect(first.headers["set-cookie"]).toBeTruthy();

    // token is now burned
    const used = await db
      .select()
      .from(schema.loginTokens)
      .where(and(eq(schema.loginTokens.userId, plainId), isNull(schema.loginTokens.usedAt)));
    expect(used).toHaveLength(0);

    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/callback",
      payload: { token },
    });
    expect(second.statusCode).toBe(401);
  });

  it("rejects a bogus token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/callback",
      payload: { token: "not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("admin allowlist", () => {
  async function sessionCookie(userId: string): Promise<string> {
    const token = await createLoginToken(userId);
    const res = await app.inject({ method: "POST", url: "/v1/auth/callback", payload: { token } });
    return cookieFrom(res.headers["set-cookie"]);
  }

  it("lets an allowlisted user hit an admin route", async () => {
    const cookie = await sessionCookie(adminId);
    const res = await app.inject({
      method: "POST",
      url: "/v1/venues",
      headers: { cookie },
      payload: { name: "Admin Venue", city: "Vancouver", country: "CA" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("blocks a non-allowlisted user from an admin route with 403", async () => {
    const cookie = await sessionCookie(plainId);
    const res = await app.inject({
      method: "POST",
      url: "/v1/venues",
      headers: { cookie },
      payload: { name: "Nope", city: "Vancouver", country: "CA" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an unauthenticated admin request with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/venues",
      payload: { name: "Nope", city: "Vancouver", country: "CA" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("logout", () => {
  it("destroys the session", async () => {
    const token = await createLoginToken(plainId);
    const cb = await app.inject({ method: "POST", url: "/v1/auth/callback", payload: { token } });
    const cookie = cookieFrom(cb.headers["set-cookie"]);

    const me1 = await app.inject({ method: "GET", url: "/v1/users/me", headers: { cookie } });
    expect(me1.statusCode).toBe(200);

    const out = await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { cookie } });
    expect(out.statusCode).toBe(204);

    const me2 = await app.inject({ method: "GET", url: "/v1/users/me", headers: { cookie } });
    expect(me2.statusCode).toBe(401);
  });
});

// The SESSION_COOKIE import documents the cookie name under test.
void SESSION_COOKIE;
