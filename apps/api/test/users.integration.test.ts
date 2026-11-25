import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession } from "../src/auth.js";
import { SESSION_COOKIE } from "../src/cookies.js";
import { db, schema, sqlClient } from "../src/db/client.js";

// Integration tests for RR-14 admin provisioning. Require Postgres + migrations.

let app: Awaited<ReturnType<typeof buildApp>>;

const adminId = "00000000-0000-0000-0000-0000000000a1";
const plainId = "00000000-0000-0000-0000-0000000000b2";

async function cookie(userId: string): Promise<{ cookie: string }> {
  return { cookie: `${SESSION_COOKIE}=${await createSession(userId)}` };
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
  await db.delete(schema.sessions);
  await db.delete(schema.loginTokens);
  await db.delete(schema.users);
  await db.insert(schema.users).values([
    { id: adminId, username: "admin", email: "admin@x.io" },
    { id: plainId, username: "plain", email: "plain@x.io" },
  ]);
});

describe("POST /users (admin provisioning)", () => {
  it("creates a user for an allowlisted admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/users",
      headers: await cookie(adminId),
      payload: { username: "nabeel", email: "nabeel@real.io" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.username).toBe("nabeel");

    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, "nabeel"))
      .limit(1);
    expect(row!.email).toBe("nabeel@real.io");
  });

  it("lowercases the email so login lookup matches", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/users",
      headers: await cookie(adminId),
      payload: { username: "mixed", email: "Mixed.Case@Real.IO" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.email).toBe("mixed.case@real.io");
  });

  it("returns 409 on a duplicate username or email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/users",
      headers: await cookie(adminId),
      payload: { username: "plain", email: "different@real.io" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects a non-admin with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/users",
      headers: await cookie(plainId),
      payload: { username: "nope", email: "nope@real.io" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/users",
      payload: { username: "nope", email: "nope@real.io" },
    });
    expect(res.statusCode).toBe(401);
  });
});
