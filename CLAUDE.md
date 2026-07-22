# Rave Reviews

An IMDB-style platform for electronic music shows and raves. You review **the night**
— not a fixed title — across multiple dimensions, and reviews credibility rests on
verified attendance.

This project is **both** a portfolio piece (to talk through in interviews) and a real
product intended to be used. Decisions are optimized for the intersection: ship a
narrow, usable product whose interesting engineering is also worth showing off.

## Status

Design phase complete through the data model, system architecture, and the primary
request lifecycle. **Not yet done:** the API surface pass and the concrete SQL schema /
ERD. No application code written yet beyond an early throwaway UI prototype (see below).

## Stack (decided)

- **Frontend:** React + TypeScript
- **Backend:** Node + TypeScript (single service, linear request path)
- **Database:** Postgres (relational — the data is deeply join-heavy)

## How to read these docs

Read them in this order; each builds on the last.

1. `docs/product-decisions.md` — what the product is and the rating model. The
   most decision-dense file; everything else serves these choices.
2. `docs/data-model.md` — entities, relationships, and the settled modeling questions.
3. `docs/architecture.md` — system design, the aggregation seam, compute-on-read vs
   phase-2 compute-on-write.
4. `docs/request-lifecycle.md` — end-to-end trace of submitting an event review.
5. `docs/open-questions.md` — what's parked, what's next, and why.

## Working principles established during design

These shaped every decision and should keep shaping them:

- **Ship-first.** This must actually get built. Prefer the simple version now, but
  isolate it behind a clean seam so the interesting version slots in later without
  upstream rework. (Applied to: compute-on-read, weight config, materialized scores.)
- **Design ahead only for concretely-specified futures.** Festivals and venue ratings
  were designed-for because they had concrete shape. Brand and the score cache are
  kept/planned but not built. "Might be nice" is not a reason to carry weight.
- **One source of truth.** Never encode the same fact via two paths that can drift.
  This killed the `event.headliner` column and the direct `set → festival` link.
- **Stay in sync deliberately.** Decisions get restated and confirmed, not assumed.
  If something here reads as decided, it was explicitly agreed — not inferred.

## Note on the early prototype

An early standalone HTML prototype exists (`rave-reviews.html`, delivered separately).
It predates several decisions and is **out of date** — notably it uses four dimensions
including "Lineup" and "Sound" as separate axes. The current model is Music / Crowd /
Production / Venue. Treat the prototype as visual/tonal reference only, not as spec.
