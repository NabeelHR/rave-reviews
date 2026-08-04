# Rave Reviews — Board

A lightweight Jira-style board. Cap: **10 active tasks.** When a card lands in Done,
prune it or archive below so the board never exceeds ten.

**Legend:** Priority `P1` (now) → `P3` (later) · Est. in ideal days · `⛔` = blocked

---

## 📋 Backlog

| ID | Task | Priority | Est. | Notes |
|------|------|:--:|:--:|-------|
| RR-8 | **Venue score aggregation** — third aggregation fn alongside event/artist; the seam already exists | P3 | 1 | Wait for review volume to make it meaningful |
| RR-9 | **Phase-2 aggregation cache** — compute-on-write with 5-min per-entity debounce | P3 | 3 | Only once read latency actually bites |
| RR-10 | **Geo filter** — swap `venues.lat/lng` text→numeric, add `?near=lat,lng&radius=` | P3 | 2 | Bounding-box math fine for the Vancouver wedge; PostGIS optional |

## 🔜 To Do

| ID | Task | Priority | Est. | Notes |
|------|------|:--:|:--:|-------|
| RR-2 | **Wire remaining frontend pages to the API** — Artist, Venue, Set, User profile; fill data gaps left by the scaffold | P1 | 3 | Depends on RR-1 confirming the client works |
| RR-3 | **Real auth (iteration 2)** — replace `X-User-Id` / `X-Admin` header stubs with NextAuth-or-similar sessions | P1 | 3 | Unblocks a shippable product |
| RR-4 | **Real user roles** — back `requireAdmin` with a DB role instead of the `X-Admin: true` header trick | P2 | 1 | ⛔ Depends on RR-3 |
| RR-5 | **Add `/v1` prefix** — Fastify plugin `{ prefix: "/v1" }` sweep across routes | P2 | 0.5 | Mechanical; do alongside RR-6 |
| RR-6 | **Cursor pagination** — keyset on list endpoints, replacing `?limit=` only | P2 | 1.5 | Mechanical |
| RR-7 | **RFC 7807 errors** — swap simple `{ error }` JSON for problem+json | P3 | 1 | Small, improves API polish |

## 🚧 In Progress

| ID | Task | Priority | Est. | Notes |
|------|------|:--:|:--:|-------|
| RR-1 | **Verify frontend golden path** — Discovery → Event detail → review submission against the live API; `docker compose up` + seed first | P1 | 1 | The frontier — scaffold landed but path unproven |

## ✅ Done

| ID | Task | Shipped |
|------|------|---------|
| — | Design docs (product, data model, architecture, request lifecycle, API surface) | 2026-07 |
| — | Backend iteration 1 — schema + migration, seed, full route surface, aggregation seam, tests green | 2026-07-23 |
| — | Frontend scaffold — Vite + React + Tailwind, page shells + API client | commit `6af5a7f` |

---

### Notes on scope
- Board reflects the deferrals recorded in `docs/iteration-1-status.md` — nothing here
  is a surprise; these are the parked/planned items made trackable.
- **Ingestion worker** (second admin-authoritative writer, alias resolution) is
  intentionally *not* on the board yet — it stays parked in `docs/open-questions.md`
  until catalog-by-hand actually hurts. Promote it when it does.
