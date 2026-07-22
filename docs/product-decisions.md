# Product decisions

The decision-dense heart of the project. Everything in the data model and architecture
serves these choices.

## Concept

IMDB-for-raves. The key difference from IMDB drives everything: a film is a fixed,
permanent object many people rate. A rave is a **time- and place-bound experience that
expires**, often recurring as editions. You review *the night*, not a title.

Consequences of that difference:

- **Multi-dimensional ratings**, not one star score — a great lineup in a dead room is a
  real, separable outcome.
- **Verified attendance** as the trust layer — the equivalent of a verified purchase,
  and the anti-brigading mechanism.
- **Discovery is location + time driven** — "techno near me this weekend" matters far
  more than it does for movies.

## Scope

- **Geographic wedge: Vancouver.** A real, seedable, believable local scene. Solves
  cold-start (you can't bootstrap network effects globally) and makes the corpus
  credible for the portfolio. Expandable later.
- **First user:** someone deciding whether a specific *upcoming* night is worth the
  ticket and the late night. Note this is upcoming-facing — a reviews-of-the-past site
  is a museum; returning users need decision support for nights that haven't happened,
  which leans on artist reputation and past editions.

## Atomic unit of review

**The event**, with a **single headliner as the default** (e.g. a John Summit stadium
show — the event essentially *is* that artist's show).

- **Set scores are optional and lightweight** — a single number per set, not a full
  review. Skip the opener you missed with no penalty; the event review stands alone.
- **The event's overall does not blindly become the artist's score.** See inheritance
  below — only the Music dimension flows to the headliner.
- **Festivals** (multi-headliner, multi-stage, multi-day) are a **later, separate
  sub-product.** Parked but designed-for (see data model: `set → event → festival`).

## Event rating dimensions (4)

**Music · Crowd · Production · Venue**

- **Music** — the artist's actual performance / the set. The artist-attributable axis.
  This is the *high-coverage* signal for artist reputation (captured on every event
  review), where explicit set scores are the *high-detail, low-coverage* signal.
- **Crowd** — energy, vibe, how the people were. High-salience, highly variable
  night-to-night.
- **Production** — lights, lasers, visuals, pyro, stage design. Distinct and
  independent (great production ≠ great crowd). **Nullable** — some nights have
  essentially no production by design; that is "N/A", not a low score.
- **Venue** — the room and how it sounded. Absorbs audio/rig quality ("Sound" as a
  standalone dimension was folded in here) and absorbs safety.

Dropped/absorbed along the way, deliberately:

- **Lineup** — dropped. Once sets are rated separately it duplicated them; artist
  quality now lives entirely in Music + set scores.
- **Sound** — folded into Venue. Low-salience (only noticed when broken) and overlaps
  with the room. *Caveat:* if the audiophile/soundsystem-culture scene turns out to be
  core to the Vancouver wedge, reconsider splitting it back out.
- **Safety** — absorbed into Crowd + Venue (implicit, not a dedicated slider).
  *Caveat:* if "is this a safe night" becomes a top reason people use the product,
  revisit — implicit safety shapes scores but never surfaces as its own signal.

## Music inheritance (fixes the "unfair to the artist" problem)

Problem: if the event *overall* flowed to the headliner, a great set in a bad room (poor
venue, thin security, mediocre rig) would unfairly tank the artist for things they don't
control.

Rule: **only the Music dimension inherits to the headliner, as one input** to their
artist average — never the overall. Bad venue/crowd/production no longer drag the artist
down. Explicit set ratings are **additional inputs** to the same average, not
replacements.

## Artist blended score

A **single blended number, shown as a breakdown** (never hidden — a hidden weighted
penalty feels arbitrary the moment it's noticed; the visible breakdown feels fair):

```
artist_score = 0.65 * Music + 0.15 * Crowd + 0.20 * Production
```

- **Inputs:** Music from inherited event reviews + explicit set scores; Crowd and
  Production are the **event's** Crowd/Production scores for events where the artist
  **headlined**, averaged across those events.
- **Rationale for including Crowd/Production at all:** they aren't purely exogenous — an
  artist's fanbase partly *is* their crowd, and some artists invest heavily in their own
  visual production. So they carry *weighted* influence, but far less than Music.
- **N/A production renormalizes.** When Production is null, the blend renormalizes over
  the remaining weights (Music 65 / Crowd 15 → ~81/19) rather than counting absent
  production as zero. Without this the model silently favors big-visual stadium acts
  over underground warehouse acts. (Crowd renormalizes the same way if ever null.)

## Weights are calibratable

The intent is that dimension weights can be **tuned later** without a code rewrite.
Conceptually they are per-entity **weight profiles** (artist leans on Music; venue will
lean on Venue; brand later leans on Crowd/Production). Physically, for v1 they live as a
**constant in the aggregation service** (not a DB table) — simpler, and acceptable that
retuning means a redeploy. The generic "weighted projection of event dimensions onto an
entity" shape is what lets venue/brand ratings slot in later with no new aggregation
logic.

## Venue ratings (future, backend-designed-for)

Not surfaced in v1 product. But the backend is designed generically so venue ratings are
just a new weight profile + link, no new machinery. Anticipated profile:

```
venue_score = 0.50 * Venue + 0.15 * Crowd + 0.20 * Production + 0.15 * Music
```

## Set-level descriptive tags (PARKED)

Idea: neutral **descriptive tags** on sets/artists (e.g. high-energy, hypnotic,
technical, plays-the-hits, deep-cuts, experimental) — *not* scored dimensions.

- Why tags not scores: qualities like "uniqueness" and "mainstream" are **not on a
  good–bad axis** — mainstream isn't worse than underground. Scoring them bakes a taste
  judgment into the data and alienates half the users. Tags let a listener *filter to
  preference* and build an artist "tag profile" (what an artist is *like*) without a
  quality judgment.
- Set score itself stays a **single number** (robust reputation signal); at most one
  optional performance axis (energy) if data later shows people reaching for it.
- **Parked decision:** structured tags (fixed vocabulary, tappable, aggregate into a
  filterable profile) vs. freeform tags in comment text (read nicely, don't aggregate
  without NLP). Only structured tags feed an artist tag-profile. Revisit when real
  reviews exist.

## Off-radar / word-of-mouth scene (PARKED, out of scope for v1)

Unadvertised, word-of-mouth warehouse events whose producers prefer to stay off-radar
are **out of scope for v1**. This is partly what conveniently scopes the "no production"
case down to rare. Noted as a real product decision (it's a chunk of credible
underground culture that could differentiate from Resident Advisor) — parked, not
rejected.

## Brand / recurring nights (kept, invisible in v1)

A **Brand** = a recurring night / promoter identity spanning multiple events (editions).
Kept in the model but **invisible in v1**, on the explicit commitment that
recurring-night discovery ("how were the last three editions of this night?") is an
**intended future product feature**. It is *not* backend-load-bearing today.
