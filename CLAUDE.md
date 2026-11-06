# Rave Reviews

An IMDB-style platform for electronic music shows and raves. You review **the night**
— not a fixed title — across multiple dimensions, and reviews credibility rests on
verified attendance.

This project is **both** a portfolio piece (to talk through in interviews) and a real
product intended to be used. Decisions are optimized for the intersection: ship a
narrow, usable product whose interesting engineering is also worth showing off.

## Status

Design phase complete (data model, architecture, request lifecycle, API surface —
`docs/api-surface.md`). **Iteration 1 backend is built and green:** full 11-table
Drizzle schema + migration applied, Vancouver seed dataset, the complete route surface
(Fastify + drizzle-orm + Postgres), the isolated aggregation seam (compute-on-read),
and passing unit + integration tests — see `docs/iteration-1-status.md`. **Frontend is
scaffolded** (Vite + React + Tailwind, page shells + API client under `apps/web`); the
Discovery → Event → review-submit golden path is not yet verified end-to-end.

Auth is still stubbed (`X-User-Id` / `X-Admin: true` headers); real auth is iteration 2.
Deliberate iteration-1 deferrals (no `/v1` prefix, no cursor pagination, simple `{error}`
JSON, no geo filter) are documented in `docs/iteration-1-status.md`.

**Work tracking:** the **GitHub Project** is the single source of truth — start
there for what's next: <https://github.com/users/NabeelHR/projects/2> (each `RR-N`
task is a GitHub issue). `docs/board.md` is **deprecated** (frozen historical
snapshot — do not use).

**PR ↔ task convention:** every change lands via PR from a branch (never commit to
main), and every PR references its task:

- **Branch:** `rr-<N>-<slug>` — e.g. `rr-2-wire-pages`.
- **PR title:** `RR-<N> <type>(<scope>): <summary>` — the `RR-<N>` comes **first**, and
  `(<scope>)` is **required**. e.g. `RR-2 feat(web): wire profile pages`.
- **PR body + commit trailer:** include `Closes #<issue>` using the **GitHub issue
  number**, not `RR-<N>`.

On merge, `Closes #<issue>` auto-closes the issue and the Project's "closed → Done"
workflow moves the card to Done — no manual status change needed. `RR-<N>` is the
human task label (in the title); `#<issue>` is the GitHub link (in the body, for
automation). The two numbering systems differ: `RR-<N>` is the stable task ID, while
`#<n>` is GitHub's shared counter across *both* issues and PRs — they do not line up.

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
