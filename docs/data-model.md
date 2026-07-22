# Data model (conceptual)

Storage is **relational — Postgres**. The data is deeply relational: sets join events to
artists, reviews fan into multiple entities, and the rating model is aggregation across
joins. That is Postgres's home turf and a document store's weakness (denormalization +
consistency fights on exactly the writes that need one transaction).

This is the *conceptual* model. The concrete SQL schema / ERD is not yet written.

## Three zones (the core invariant)

Entities split into three zones, and the split encodes a rule: **users write only the
middle zone, the system derives the bottom zone, and nobody rates the top zone
directly.**

### 1. Catalog — the world, independent of opinions

Facts, not judgments: a set *happened*, an artist *played it*.

- **Venue** — room, geo, capacity.
- **Artist** — owns alias / canonical-name resolution (the entity-resolution work the
  future ingestion worker leans on: "Roqia" vs "Roqia presents …" resolve to one
  canonical artist).
- **Event** — date, status (upcoming/past), belongs to a Venue.
- **Set** — one slot in an event's lineup. **The join between Event and Artist.**
- **Brand** — recurring-night identity (invisible in v1; see product-decisions).

### 2. Contributions — the only zone users write

- **Review** — attaches to an **Event**. Carries the 4 dimension scores (Music, Crowd,
  Production, Venue) + text.
- **Set rating** — attaches to a **Set**. Optional, single number. **Requires
  attendance** (see below).
- **Attendance** — its **own entity**, not just a boolean on the review. It gives both
  reviews and set ratings their trust weight, and it may be established through a channel
  other than leaving a review (e.g. check-in / ticket upload) later.

### 3. Derived — computed, never written by users

- **Artist score**, **Event score**, **Venue score** (later). In v1 these are
  **computed on read** and need not be stored at all. They are modeled as entities
  because in phase 2 they become the materialized score cache.

## Set is the linchpin

Everything artist-to-event flows **through Set**. This one invariant makes several things
clean at once:

- **B2B sets:** one Set, multiple Artists (a `set_artist` join with a role). VELVETRONIX
  b2b K-Nought is *one* set with *two* artists.
- **Aliases:** handled at the Artist level (canonical + aliases), so reputation doesn't
  fragment across names.
- **`set → event → festival`, never `set → festival` directly.** A set reaches a festival
  only through the event it belongs to. A direct `set.festival_id` was **rejected** — it
  creates two paths to the same fact that drift out of sync. Festivals (later) become an
  entity that *groups events*; sets come along for free through their events.

## Settled modeling questions

All three were pressure-tested against the request lifecycle and closed.

### Headliner = a role on a Set (NOT a field on Event)

The headline slot is a **Set flagged as headliner** (e.g. `is_headliner`); the artist
reaches the event through that set like any other artist.

- **Why not an `event.headliner_artist_id` column:** it would be a *second, parallel*
  path from Event to Artist, bypassing Set — violating the single-link-path invariant
  and able to drift stale when the lineup is edited. Same "two paths to one fact" bug we
  rejected for `set → festival`. Consistency wins regardless of the festival argument.
- **Also handles the future cleanly:** festivals = multiple headline sets;
  co-headliners / B2B headline slots = multiple artists on the headline set, all inherit.
- **Consequence to respect:** an event's headliner is only as good as its lineup data.
  An event with *zero* sets has no headliner (not "unknown" — nothing to point at). The
  "headliner known, lineup not entered" case is just an event with **one** set entered
  (the headline slot) and the rest absent — no stub column needed.
- **Product/validation rule (parked, not schema):** an event should have ≥1 set before
  it's publicly listed, else show "lineup TBA".

### Set rating requires attendance

You can leave an **event review without attending** (weighted low by trust). You
**cannot** leave a **set rating** without attendance — you can't judge a specific set
from the outside. This also means set ratings only ever come from verified attendees,
which simplifies the write path.

### One review per user per event

Enforced as a **unique constraint** (`unique(user_id, event_id)`), not check-then-insert
(which races under concurrency). Edits are **updates** to the existing row.

## Relationship summary

- Event → Venue (many-to-one)
- Event → Brand (many-to-one, nullable; invisible v1)
- Set → Event (many-to-one); one Set may be flagged headliner
- Set ↔ Artist (many-to-many via `set_artist`, carries role — handles B2B)
- Review → Event (many-to-one; unique per user+event)
- Set rating → Set (many-to-one; requires attendance)
- Attendance → User + Event (own entity; weights reviews and set ratings)
- Derived scores: computed from Contributions + Catalog, per the weight profiles
