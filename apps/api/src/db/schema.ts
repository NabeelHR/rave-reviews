import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- Catalog ----------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  region: text("region"),
  country: text("country").notNull(),
  lat: text("lat"),
  lng: text("lng"),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    canonicalName: text("canonical_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    canonicalIdx: index("artists_canonical_idx").on(t.canonicalName),
  }),
);

// Aliases resolve to a canonical Artist row (many aliases → one artist).
export const artistAliases = pgTable(
  "artist_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => ({
    aliasUnique: uniqueIndex("artist_aliases_alias_unique").on(t.alias),
  }),
);

// Brand: recurring-night identity. Kept but invisible in v1.
export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    startsAtIdx: index("events_starts_at_idx").on(t.startsAt),
    venueIdx: index("events_venue_idx").on(t.venueId),
  }),
);

// A slot in an event's lineup — the join between Event and Artist.
export const sets = pgTable(
  "sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    isHeadliner: boolean("is_headliner").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    position: integer("position"),
  },
  (t) => ({
    eventIdx: index("sets_event_idx").on(t.eventId),
    // At most one headliner set per event (partial unique index).
    oneHeadlinerPerEvent: uniqueIndex("sets_one_headliner_per_event")
      .on(t.eventId)
      .where(sql`${t.isHeadliner} = true`),
  }),
);

// Many-to-many for B2Bs; role is 'primary' | 'b2b' etc.
export const setArtists = pgTable(
  "set_artists",
  {
    setId: uuid("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    role: text("role").notNull().default("primary"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.setId, t.artistId] }),
    artistIdx: index("set_artists_artist_idx").on(t.artistId),
  }),
);

// ---------- Contributions ----------

// Attendance is its own entity (see data-model). Uniqueness on (user, event).
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unique: uniqueIndex("attendance_user_event_unique").on(t.userId, t.eventId),
    eventIdx: index("attendance_event_idx").on(t.eventId),
  }),
);

// Review scores are integers 1..10; production is nullable ("N/A").
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    music: smallint("music").notNull(),
    crowd: smallint("crowd").notNull(),
    production: smallint("production"),
    venue: smallint("venue").notNull(),
    text: text("text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userEventUnique: uniqueIndex("reviews_user_event_unique").on(t.userId, t.eventId),
    eventIdx: index("reviews_event_idx").on(t.eventId),
    scoreCheck: check(
      "reviews_scores_range",
      sql`${t.music} between 1 and 10
        and ${t.crowd} between 1 and 10
        and (${t.production} is null or ${t.production} between 1 and 10)
        and ${t.venue} between 1 and 10`,
    ),
  }),
);

// ---------- Auth (RR-3) ----------

// Single-use magic-link tokens. We store a hash; the raw token only ever
// travels in the emailed link. Invite-only: a token is minted only for an
// email that already maps to a user, so userId is captured at request time.
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex("login_tokens_token_hash_unique").on(t.tokenHash),
    userIdx: index("login_tokens_user_idx").on(t.userId),
  }),
);

// Server-side sessions. The cookie carries a random token; we store its hash.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const setRatings = pgTable(
  "set_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    setId: uuid("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userSetUnique: uniqueIndex("set_ratings_user_set_unique").on(t.userId, t.setId),
    setIdx: index("set_ratings_set_idx").on(t.setId),
    scoreCheck: check("set_ratings_score_range", sql`${t.score} between 1 and 10`),
  }),
);
