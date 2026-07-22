# API surface

The HTTP surface for v1. Grouped by resource, with the auth boundary marked. Designed
against the request lifecycle (`docs/request-lifecycle.md`) so the write path fits
without a specialized RPC-style route.

## Conventions

- **Base:** `/v1/…` — versioning is cheap to lock in now, expensive to retrofit.
- **Auth boundary:** 🔓 public · 🔒 authenticated user · 🛠️ admin/internal.
- **IDs:** opaque strings in URLs; UUIDs internally.
- **Lists:** cursor pagination (`?cursor=…&limit=…`).
- **Errors:** RFC 7807 problem+json.
- **Ownership** on `PATCH`/`DELETE` of reviews & set ratings is checked distinctly from
  "logged in."

## Auth & users

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | 🔓 | Create account |
| POST | `/auth/login` | 🔓 | Session / token |
| POST | `/auth/logout` | 🔒 | End session |
| GET | `/users/me` | 🔒 | Current user profile |
| GET | `/users/me/reviews` | 🔒 | My reviews |
| GET | `/users/me/attendance` | 🔒 | My attended events |
| GET | `/users/:id` | 🔓 | Public profile (username, review count) |

No public `/users` listing — no reason to enumerate users.

## Catalog

Read-heavy. **Writes are admin-only in v1** (seeded manually; the phase-2 ingestion
worker becomes the second admin-authoritative writer). User-submitted catalog with
moderation is a real product feature but is not designed for in v1.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/venues` | 🔓 | List/filter (`?near=lat,lng&radius=`) |
| GET | `/venues/:id` | 🔓 | Venue detail; embeds venue_score once surfaced |
| GET | `/venues/:id/events` | 🔓 | Events at venue |
| GET | `/artists` | 🔓 | Search (`?q=`) |
| GET | `/artists/:id` | 🔓 | Artist detail; **embeds blended artist_score + breakdown** |
| GET | `/artists/:id/sets` | 🔓 | Sets this artist played (past + upcoming) |
| GET | `/events` | 🔓 | Discovery: `?near=&from=&to=&artist=&venue=&status=upcoming\|past` |
| GET | `/events/:id` | 🔓 | Event detail; **embeds sets, event_score, dimension averages** |
| GET | `/events/:id/sets` | 🔓 | Lineup (kept alongside the embed for cache freshness) |
| GET | `/sets/:id` | 🔓 | Set detail (artist(s), role, aggregated set score) |
| POST/PATCH/DELETE | `/venues`, `/artists`, `/events`, `/events/:id/sets` | 🛠️ | Catalog CRUD |

**Brand** endpoints exist in the schema but are not exposed in v1 (invisible-in-v1
decision from product-decisions).

**No dedicated score endpoints.** Scores are embedded in the resource GETs — matches
compute-on-read and avoids a second round-trip. In phase 2 the same fields become
cache-backed with no API change (the aggregation seam pays off here).

## Contributions

The only zone users write. Reviews are **written nested** under events (matches the
"review of an event" mental model) but are **also addressable flat** for edits and
listings.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/events/:id/reviews` | 🔒 | Create review + optional set ratings, one txn |
| GET | `/events/:id/reviews` | 🔓 | Reviews for an event |
| GET | `/reviews/:id` | 🔓 | Single review |
| PATCH | `/reviews/:id` | 🔒 (author) | Edit — unique constraint means edits are updates, not new rows |
| DELETE | `/reviews/:id` | 🔒 (author) | |
| POST | `/events/:id/attendance` | 🔒 | Standalone check-in / ticket upload |
| DELETE | `/events/:id/attendance` | 🔒 | Retract |
| POST | `/sets/:id/rating` | 🔒 (attended) | Standalone set rating (unbundled) |
| PATCH | `/sets/:id/rating` | 🔒 (author) | |
| DELETE | `/sets/:id/rating` | 🔒 (author) | |

Standalone set-rating endpoints are kept even though most ratings arrive bundled in
the review POST — editing or deleting a single set score shouldn't require re-sending
the whole review, and "I forgot to rate the opener" shouldn't require touching the
review either.

### Review POST payload

```
{ scores: { music, crowd, production|null, venue },
  text,
  setRatings: [{ setId, score }]
}
```

**Attendance is not carried in this payload.** It is established out-of-band via
`POST /events/:id/attendance` (check-in / ticket upload). On review write the server
*reads* the Attendance row for `(user, event)`: its presence drives the review's trust
weight and gates `setRatings` (rejected if no attendance exists). The two-call cost is
honest — attendance is a separate act, not a checkbox on a review.

## How this maps to the request lifecycle

Walking `docs/request-lifecycle.md`:

1. **Client submits review** → `POST /events/:id/reviews` with the payload above.
2. **API validates** → auth middleware + score-range validator; one-per-user enforced
   by the DB unique constraint on write (not check-then-insert).
3. **Resolve attendance** → server reads the Attendance row; drives trust weight;
   rejects `setRatings` if absent.
4. **Write — one transaction** → single handler, single DB txn covering `review` +
   `set_rating[]`. Attendance is read, not written.
5. **Mark dirty** → internal to the handler, no API shape. v1 no-op behind the
   aggregation seam.
6. **Respond** → return the created review. Derived scores are not in the response;
   the next `GET /events/:id` / `GET /artists/:id` recomputes on read.

No endpoint gap; the lifecycle fits without a dedicated write RPC.
