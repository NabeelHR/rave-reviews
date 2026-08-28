import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, schema, sqlClient } from "../src/db/client.js";

// Integration tests. Require a running Postgres reachable via DATABASE_URL and
// migrations applied. Boot with:
//   npm run db:up && npm run db:migrate

let app: Awaited<ReturnType<typeof buildApp>>;

const userA = "00000000-0000-0000-0000-000000000001";
const userB = "00000000-0000-0000-0000-000000000002";
let venueId: string;
let eventId: string;
let setId: string;

async function wipe() {
  await db.delete(schema.setRatings);
  await db.delete(schema.reviews);
  await db.delete(schema.attendance);
  await db.delete(schema.setArtists);
  await db.delete(schema.sets);
  await db.delete(schema.events);
  await db.delete(schema.artists);
  await db.delete(schema.venues);
  await db.delete(schema.users);
}

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await sqlClient.end();
});

beforeEach(async () => {
  await wipe();

  await db.insert(schema.users).values([
    { id: userA, username: "a", email: "a@x.io" },
    { id: userB, username: "b", email: "b@x.io" },
  ]);
  const [v] = await db
    .insert(schema.venues)
    .values({ name: "Test Room", city: "Vancouver", country: "CA" })
    .returning();
  venueId = v!.id;
  const [e] = await db
    .insert(schema.events)
    .values({ name: "Test Night", venueId, startsAt: new Date() })
    .returning();
  eventId = e!.id;
  const [s] = await db
    .insert(schema.sets)
    .values({ eventId, isHeadliner: true, position: 1 })
    .returning();
  setId = s!.id;
});

describe("POST /events/:id/reviews", () => {
  it("creates a review with no set ratings, no attendance required", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      headers: { "x-user-id": userA },
      payload: { scores: { music: 8, crowd: 7, production: 9, venue: 6 } },
    });
    expect(res.statusCode).toBe(201);
  });

  it("upserts on the (user, event) unique constraint (edit = update)", async () => {
    const first = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      headers: { "x-user-id": userA },
      payload: { scores: { music: 5, crowd: 5, production: 5, venue: 5 } },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      headers: { "x-user-id": userA },
      payload: { scores: { music: 9, crowd: 9, production: 9, venue: 9 } },
    });
    expect(second.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.reviews)
      .where(eqTuple(userA, eventId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.music).toBe(9);
  });

  it("rejects set ratings when the user has no attendance record", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      headers: { "x-user-id": userA },
      payload: {
        scores: { music: 8, crowd: 8, production: 8, venue: 8 },
        setRatings: [{ setId, score: 9 }],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts set ratings once attendance exists", async () => {
    const attend = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/attendance`,
      headers: { "x-user-id": userA },
    });
    expect(attend.statusCode).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      headers: { "x-user-id": userA },
      payload: {
        scores: { music: 8, crowd: 8, production: null, venue: 8 },
        setRatings: [{ setId, score: 9 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const setRatings = await db.select().from(schema.setRatings);
    expect(setRatings).toHaveLength(1);
    expect(setRatings[0]!.score).toBe(9);
  });

  it("requires auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/events/${eventId}/reviews`,
      payload: { scores: { music: 8, crowd: 8, production: 8, venue: 8 } },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /events/:id", () => {
  it("returns event detail with aggregate computed on read", async () => {
    await db.insert(schema.reviews).values([
      { userId: userA, eventId, music: 8, crowd: 8, production: 10, venue: 6 },
      { userId: userB, eventId, music: 10, crowd: 6, production: null, venue: 6 },
    ]);
    const res = await app.inject({ method: "GET", url: `/v1/events/${eventId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      aggregate: { reviewCount: number; dimensions: { music: number; production: number } };
    };
    expect(body.aggregate.reviewCount).toBe(2);
    expect(body.aggregate.dimensions.music).toBeCloseTo(9);
    expect(body.aggregate.dimensions.production).toBeCloseTo(10);
  });
});

// tiny helper: equality on both columns
import { and, eq } from "drizzle-orm";
function eqTuple(u: string, e: string) {
  return and(eq(schema.reviews.userId, u), eq(schema.reviews.eventId, e));
}
