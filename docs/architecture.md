# System architecture

## Request path (v1 — deliberately linear)

```
Client (React/TS)  →  API service (Node/TS)  →  Aggregation service  →  Postgres
```

No message queue, no microservices, no event sourcing in v1. A single Node/TS service
talking to one Postgres. Anything fancier is résumé-driven development that slows the
ship. The interesting engineering lives in *one* box (aggregation), not in the plumbing.

## The aggregation service (the load-bearing seam)

Its own module, **not** logic smeared through API handlers. It holds *all* scoring rules:

- the artist blend (`0.65 Music + 0.15 Crowd + 0.20 Production`)
- N/A-production renormalization
- Music-only inheritance to the headliner
- the per-entity weight profiles (constant in this service for v1)

Isolating it buys two things:

1. **Single place scoring changes** — tweak weights, touch one file.
2. **A clean boundary the materialized cache slots behind.** In v1 it computes on read
   (query reviews → blend → return). In phase 2 its output is precomputed on write into
   a cache, and **nothing upstream changes** — the API still just asks the aggregation
   layer for a score. Same interface, different implementation.

## Compute-on-read (v1) → compute-on-write (phase 2)

- **v1: compute-on-read.** Scores are calculated from the data on each read. Simple,
  always fresh, no pipeline, no staleness. Cost: read-time compute. Correct choice for
  shipping.
- **phase 2: compute-on-write (materialized).** On write, recompute the affected
  entity's score and store it; reads become instant lookups. This is the version worth
  showing off. It slots behind the aggregation seam without touching the API or schema.

### Recompute throttle (phase 2) — get this detail right

When compute-on-write lands, recompute is **throttled per entity with a 5-minute
floor** — and this is **debouncing/coalescing, NOT a cron job**:

- A review lands → mark that entity dirty → recompute, **but don't recompute that same
  entity again for 5 minutes** no matter how many more reviews land in the window.
- A hot headliner getting 200 reviews during a festival triggers **one** recompute per
  5 min, not 200. That burst protection is the entire point of the rule.
- The naive "cron every 5 minutes over everything" is wrong: it recomputes entities
  nobody touched and adds up-to-5-min latency to every update even at trivial traffic.

## Phase-2 components (designed-for, not built)

- **Ingestion worker** — pulls lineups from external sources (e.g. Resident Advisor,
  Bandsintown), then does artist **dedup / B2B / alias resolution**. This is the
  strongest interview narrative (entity resolution) and the most interesting subsystem.
  A separate Node/TS worker process. Writes into Postgres; the schema and Set/Artist
  model are already shaped for it.
- **Score cache** — the materialized store for compute-on-write (Redis or a Postgres
  table). Populated by the throttled recompute; read path skips the blend.

Neither is built in v1. Both are non-blocking additions because the seam and schema
don't fight them.

## Stack

- **Frontend:** React + TypeScript
- **API:** Node + TypeScript (single service)
- **DB:** Postgres
- **(phase 2)** Node/TS ingestion worker; Redis or Postgres score cache

Node/TS was chosen over Go primarily for **ship speed** as a solo builder: end-to-end
type sharing with the React frontend, mature ecosystem (Prisma/Drizzle, NextAuth), one
language across the stack. The aggregation math is light, so Go's CPU/concurrency edge
doesn't bite here. If the ingestion worker ever wants Go's concurrency story, it can be a
separate service — but default is Node/TS everywhere.
