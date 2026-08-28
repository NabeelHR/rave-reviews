# Iteration 1 — status & next steps

Snapshot of where the build stands after the API-routes pass on 2026-07-21.

## What's in place

### Database
- Postgres 16 running via `docker compose` (container `ravereviews-db-1`,
  `postgres://rr:rr@localhost:5432/ravereviews`).
- Full schema applied — Drizzle migration `apps/api/drizzle/0000_minor_sharon_ventura.sql`.
- 11 tables covering the three zones from `data-model.md`:
  - Catalog: `users`, `venues`, `artists`, `artist_aliases`, `brands`, `events`,
    `sets`, `set_artists`.
  - Contributions: `attendance`, `reviews`, `set_ratings`.
- Invariants enforced in SQL:
  - `reviews_user_event_unique`, `attendance_user_event_unique`,
    `set_ratings_user_set_unique`.
  - `sets_one_headliner_per_event` — partial unique index on `event_id WHERE is_headliner`.
  - `reviews_scores_range` / `set_ratings_score_range` — 1..10, production nullable.

### Seed
- `apps/api/src/db/seed.ts` — wipe-and-reseed, hand-crafted Vancouver dataset
  (3 users, 4 venues, 4 events including one B2B, attendance + reviews + set ratings,
  one review with `production: null` exercising the N/A path).
- Run with `npm run db:seed` from `apps/api/`.

### API (Fastify + drizzle-orm + zod)
Routes wired in `apps/api/src/app.ts`. All present, typecheck clean, tests green.

**Auth (stub)**
- `POST /auth/signup` — create user
- `POST /auth/login` — 501 (real auth is iteration 2)
- `POST /auth/logout` — 204
- `requireUser` middleware trusts `X-User-Id` header
- `requireAdmin` middleware trusts `X-Admin: true` header

**Users**
- `GET /users/me`, `GET /users/me/reviews`, `GET /users/me/attendance`
- `GET /users/:id` (public profile + review count)

**Venues**
- `GET /venues` (filters: `?city=&q=&limit=`)
- `GET /venues/:id`, `GET /venues/:id/events`
- Admin CRUD: `POST/PATCH/DELETE /venues[/:id]`

**Artists**
- `GET /artists?q=` (name search)
- `GET /artists/:id` — embeds blended artist score + breakdown
- `GET /artists/:id/sets`
- Admin CRUD: `POST/PATCH/DELETE /artists[/:id]`

**Events**
- `GET /events` — discovery: `?from=&to=&artist=&venue=&city=&status=upcoming|past&q=&limit=`
- `GET /events/:id` — embeds sets + venue + event aggregate
- `GET /events/:id/sets`
- Admin CRUD: `POST/PATCH/DELETE /events[/:id]`
- Admin sub-CRUD for lineup: `POST /events/:id/sets`, `PATCH/DELETE /events/:id/sets/:setId`
  (transactionally maintains `set_artists`)

**Sets**
- `GET /sets/:id` — set detail with artists + rating avg
- `POST/PATCH/DELETE /sets/:id/rating` — attendance-gated

**Reviews**
- `POST /events/:id/reviews` — creates review + optional bundled set ratings in one txn;
  reads attendance to gate `setRatings` and to establish trust weight
- `GET /events/:id/reviews`, `GET /reviews/:id`
- `PATCH /reviews/:id`, `DELETE /reviews/:id` — author-owned

**Attendance**
- `POST /events/:id/attendance` (idempotent upsert), `DELETE /events/:id/attendance`

### Aggregation
- Module at `apps/api/src/aggregation/` holds all scoring logic — the isolated seam
  from `architecture.md`. v1 = compute-on-read; phase-2 cache slots in behind the
  same seam without route changes.

### Tests
- 9 unit tests (aggregation) + 6 integration tests (reviews). All passing.
- Live smoke test verified the discovery-by-artist path and end-to-end artist blend.

## Deviations from `docs/api-surface.md`

Intentional trade-offs for iteration 1 — worth revisiting later:

- ~~**No `/v1` prefix.**~~ **Done (RR-5).** All routes now register inside a
  `{ prefix: "/v1" }` sub-instance in `app.ts`; `/health` stays unversioned. Web
  client base is `/api/v1`.
- **No cursor pagination.** Just `?limit=` (default 50, cap 200). Data is small enough
  to defer keyset until list endpoints actually feel slow.
- **Simple `{ error }` JSON, not RFC 7807 problem+json.**
- **No `?near=lat,lng&radius=`.** `venues.lat/lng` are `text` and there's no PostGIS;
  substituted `?city=` string filter.
- **Real auth deferred to iteration 2.** `X-User-Id` / `X-Admin: true` stubs are the
  entire auth story right now.

## Next steps

Roughly in order of value:

1. **Frontend (React + TypeScript).** The API surface is stable enough to build against.
   Discovery list → event detail → review submission is the golden path.
2. **Real auth** (iteration 2). NextAuth or similar; replaces the header stubs. Also
   introduces real user roles so `requireAdmin` isn't a header trick.
3. **Cursor pagination** on list endpoints and `/v1` prefix — small, mechanical.
4. **Venue score** — third aggregation function alongside event/artist, once there's
   enough review volume to make it meaningful. The seam already exists.
5. **Phase-2 aggregation cache** — the compute-on-write path with 5-minute per-entity
   debounce, per `architecture.md`. Only worth doing once read latency actually bites.
6. **Ingestion worker** — the second admin-authoritative writer for catalog data
   (artist alias resolution is the interesting piece). Currently everything is seeded
   or admin-created by hand.
7. **Geo filter** — swap `venues.lat/lng` from `text` to real numeric columns and add
   `?near=lat,lng&radius=`. PostGIS optional; simple bounding-box math works for the
   Vancouver wedge.
