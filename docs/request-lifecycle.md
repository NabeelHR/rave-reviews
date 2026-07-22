# Request lifecycle: submitting an event review

The highest-value path — it exercises every rating decision and propagates all the way to
a recomputed artist score.

## Steps

1. **Client submits review.** Payload = the 4 dimension scores (Music, Crowd, Production,
   Venue) + text + any optional set scores, in one request.

2. **API validates.** Authenticated; scores in range; **one-review-per-user-per-event**
   enforced via the unique constraint (not check-then-insert — that races).

3. **Resolve attendance.** Establish this review's **trust weight** from attendance
   before writing. An event review is allowed *without* attendance (weighted low). A
   **set rating requires attendance** — so any set scores in the payload are only valid
   from a verified attendee.

4. **Write — one transaction.** Review + any set ratings + attendance commit **together**.
   This matters *because* of the rating rules: the headliner inherits the event's Music
   score, and set ratings are additional inputs to the same artist average. Split writes
   with a partial failure would leave an artist's inputs half-applied and the blend
   computing on inconsistent data. One transaction = inputs never half-applied. (Writing
   the inherited Music requires knowing the headliner — a lookup of the event's
   headliner-flagged Set.)

5. **Mark affected entities dirty.** A single event review can move several scores: the
   event's own overall, the **headliner's** blended artist score (via inherited
   Music/Crowd/Production), and **every artist whose set was rated**. In v1 this **records
   the set but computes nothing** — it's the seam the phase-2 dirty-flag hooks into.

6. **Respond.** Write confirmed. Because v1 is **compute-on-read**, the user's next page
   load recalculates and the new scores are simply there — no recompute step, no
   staleness.

## Phase-2 delta (small on purpose)

Switching to compute-on-write changes **only step 5's dirty flag + the worker**. Steps
1–4 and 6 don't move. The dirty flag from step 5 wakes the aggregation worker; the
**per-entity 5-minute floor** coalesces a festival-night flood for one headliner into a
single recompute; the blended score is written to the cache; reads skip the blend. That
the delta is this contained is the payoff of isolating the aggregation seam.

## What this lifecycle settled

Watching the write flow made three previously-open modeling questions obvious (all now
closed — see data-model.md):

- **Headliner** → a role on a Set (the inherited-Music write needs to look up "who
  headlined", and routing it through the lineup keeps the single link path).
- **Set rating requires attendance** → you can't judge a specific set from outside.
- **One review per event** → unique constraint; the write path wants it as a DB rule,
  not an app-level check.
