# Rave Reviews

IMDB-style platform for electronic music shows. See `docs/` for design.

## Iteration 1 (this branch)

Backend vertical slice. Frontend, discovery endpoints, and real auth arrive in
iteration 2.

**What's here:**
- Postgres schema (Drizzle) for Catalog + Contributions.
- Aggregation module isolated behind the seam — event aggregate, artist blended
  score, N/A-production renormalization, weight profiles.
- Fastify API:
  - `POST /events/:id/reviews` — one-txn write of review + bundled set ratings.
  - `POST /events/:id/attendance` / `DELETE /events/:id/attendance`.
  - `GET /events/:id` — event detail + lineup + compute-on-read aggregate.
  - `GET /artists/:id` — blended artist score + breakdown.
- Auth stub (`X-User-Id` header) — real auth lands with the frontend.
- Vancouver seed data.
- Unit tests for the aggregation module + integration tests for the write path.

## Run it

Prereqs: Node 20+ and one Postgres. Pick either:

**Option A — Docker (default):**
```bash
docker compose up -d          # starts Postgres on :5432
```

**Option B — Homebrew Postgres:**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb ravereviews
# adjust DATABASE_URL in .env accordingly
```

Then:

```bash
cp .env.example .env
npm install
npm run db:migrate -w @rr/api
npm run db:seed -w @rr/api
npm run api                    # starts on :3000
```

Sanity check:
```bash
curl localhost:3000/health
# use an event id printed by the seed script:
curl localhost:3000/events/<eventId>
```

## Testing

```bash
npm test                          # unit tests (aggregation)
npm run test:integration -w @rr/api   # integration tests (require DB up + migrated)
```

## Auth stub

Every authenticated endpoint reads `X-User-Id`. The seed script prints valid
user IDs; pass one as the header:

```bash
curl -X POST localhost:3000/events/<eventId>/attendance \
  -H "X-User-Id: <userId>"
```
