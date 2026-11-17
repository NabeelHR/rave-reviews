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
- Passwordless auth — magic-link login backed by server-side sessions (cookie).
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

## Auth

Passwordless magic-link login; identity is a session cookie (`rr_session`).
Invite-only: a link is only minted for an email that already has a user row
(seeded or provisioned). In dev the "email" is printed to the API server log
(console transport) — request a link from the web UI, copy it from the log.
In production, set `GMAIL_USER` + `GMAIL_APP_PASSWORD` to deliver links from
your own Gmail (free, no domain needed), or `RESEND_API_KEY` + `EMAIL_FROM`
for [Resend](https://resend.com) with a verified domain (takes precedence).
With neither, the console transport is used and the boot log says so.

Admin is a server-side allowlist: set `ADMIN_IDS` to a comma-separated list of
user UUIDs in `.env`. There is no client-side way to claim admin.
