# Open questions & what's next

## Next design pass (not yet done)

- **API surface.** Endpoints grouped by resource, with the auth boundary marked. This was
  the immediately-next step when we paused to move to Claude Code. It's the last of three
  high-level design passes (data layer ✓, request lifecycle ✓, API surface ✗).
- **Concrete schema / ERD.** The actual Postgres tables, columns, types, constraints,
  indexes. The conceptual model (data-model.md) is agreed; the SQL is not written.

The natural sequence from here: **API surface → SQL schema → start building.**

## Parked (deliberately deferred, with reasons)

- **Descriptive tags** (structured vs. freeform) — revisit when real reviews exist; only
  structured tags feed an artist tag-profile.
- **Off-radar / word-of-mouth scene** — out of scope for v1; parked, not rejected.
- **Brand product surface** (recurring-night discovery) — entity kept, invisible in v1;
  intended future feature.
- **Festivals sub-product** — parked but designed-for (`set → event → festival`).
- **Venue ratings** — v1-out; backend designed generically so it's a new weight profile,
  not new machinery.
- **"Event needs ≥1 set to be publicly listed"** — product/validation rule, parked
  (consequence of headliner-as-set-role).
- **Splitting "Sound" back out of Venue** — only if the audiophile/soundsystem scene
  proves core to the Vancouver wedge.
- **Explicit "safety" dimension** — only if "is this a safe night" becomes a top reason
  people use the product.
- **A single optional set-performance axis (energy)** — only if tag data shows people
  reaching for it.

## Decision log (chronological highlights)

- Concept: IMDB-for-raves; both a portfolio piece and a real product; Vancouver wedge.
- Atomic unit: **event**, single-headliner default; festivals later.
- Dimensions settled at **Music · Crowd · Production · Venue** (dropped Lineup; folded
  Sound and safety into Venue/Crowd).
- **Music-only inheritance** to the headliner (fixes unfair-to-artist); set ratings are
  additional inputs.
- Artist score = **0.65 Music + 0.15 Crowd + 0.20 Production**, shown as a breakdown;
  **N/A production renormalizes**; inputs from headlined events + explicit set scores.
- Weights are **calibratable**, implemented as a **constant in the aggregation service**
  for v1 (not a table).
- Storage: **Postgres / relational** (confirmed, not just assumed).
- Catalog = Venue · Artist · Event · Set · Brand; **Set is the artist↔event join**
  (handles B2B); `set → event → festival` never `set → festival`.
- Headliner = **role on a Set**, not an Event column.
- **Set rating requires attendance**; event review doesn't (weighted).
- **One review per user per event** = unique constraint; edits are updates.
- Architecture: **linear request path**; **compute-on-read** in v1 behind an isolated
  aggregation seam; **compute-on-write** in phase 2 with a **per-entity 5-min throttle
  (debounced, not cron)**.
- Stack: **Node/TS** API + **React/TS** frontend + **Postgres**; phase-2 ingestion worker
  + score cache.

## Meta: how this project has been run

Decisions are **restated and explicitly confirmed**, not assumed — several course
corrections happened specifically because a suggestion was drifting into an unconfirmed
"decision." Keep that discipline: when something is proposed, mark it as a proposal;
when it's agreed, log it. The recommendation is usually stated with its trade-offs so the
call stays with the product owner.
