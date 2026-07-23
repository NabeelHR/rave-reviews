import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BigScore, ScoreBars } from "../components/ScoreBars";
import { api, ApiError } from "../lib/api";
import type { EventAggregate, Review, SetRow, Venue } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { useUser } from "../lib/user";

type EventDetail = {
  event: { id: string; name: string; startsAt: string; endsAt: string | null; venue: Venue | null };
  sets: SetRow[];
  aggregate: EventAggregate;
};

function Score({ label, value, onChange, allowNa }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowNa?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase text-muted mb-1">{label}</div>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded text-xs border ${
              value === n
                ? "bg-accent border-accent"
                : "bg-panel border-line hover:border-white/40"
            }`}
          >
            {n}
          </button>
        ))}
        {allowNa && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`px-2 h-8 rounded text-xs border ${
              value === null
                ? "bg-accent border-accent"
                : "bg-panel border-line hover:border-white/40"
            }`}
          >
            N/A
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewForm({
  eventId,
  existing,
  onDone,
}: {
  eventId: string;
  existing: Review | null;
  onDone: () => void;
}) {
  const { userId } = useUser();
  const [music, setMusic] = useState<number | null>(existing?.music ?? 8);
  const [crowd, setCrowd] = useState<number | null>(existing?.crowd ?? 8);
  const [production, setProduction] = useState<number | null>(
    existing ? existing.production : 8,
  );
  const [venue, setVenue] = useState<number | null>(existing?.venue ?? 8);
  const [text, setText] = useState(existing?.text ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!userId) {
    return <div className="text-muted text-sm">Sign in to leave a review.</div>;
  }

  const invalid = music == null || crowd == null || venue == null;
  const editing = !!existing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        await api(`/reviews/${existing!.id}`, {
          method: "PATCH",
          userId,
          body: {
            scores: { music, crowd, production, venue },
            text: text || null,
          },
        });
      } else {
        await api(`/events/${eventId}/reviews`, {
          method: "POST",
          userId,
          body: {
            scores: { music, crowd, production, venue },
            text: text || undefined,
          },
        });
      }
      onDone();
    } catch (e) {
      const ae = e as ApiError;
      setErr(typeof ae.body === "object" && ae.body ? (ae.body as any).error : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!existing) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/reviews/${existing.id}`, { method: "DELETE", userId });
      onDone();
    } catch (e) {
      setErr((e as ApiError).body ? ((e as ApiError).body as any).error : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-panel border border-line rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          {editing ? "Edit your review" : "Your review"}
        </div>
        {editing && (
          <span className="text-[10px] uppercase tracking-wider text-muted">
            editing
          </span>
        )}
      </div>
      <Score label="Music" value={music} onChange={setMusic} />
      <Score label="Crowd" value={crowd} onChange={setCrowd} />
      <Score label="Production" value={production} onChange={setProduction} allowNa />
      <Score label="Venue" value={venue} onChange={setVenue} />
      <div>
        <div className="text-xs uppercase text-muted mb-1">Notes</div>
        <textarea
          className="w-full bg-ink border border-line rounded p-2 text-sm min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was the night like?"
        />
      </div>
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || invalid}
          className="px-4 py-2 rounded bg-accent disabled:opacity-50 text-sm font-medium"
        >
          {busy ? "Saving…" : editing ? "Update review" : "Submit review"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={del}
            disabled={busy}
            className="px-4 py-2 rounded border border-line text-sm text-muted hover:border-red-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

export function EventPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useFetch<EventDetail>(id ? `/events/${id}` : null);
  const reviews = useFetch<{ reviews: Review[] }>(id ? `/events/${id}/reviews` : null);
  const { userId } = useUser();
  const [attendMsg, setAttendMsg] = useState<string | null>(null);

  async function attend() {
    if (!id || !userId) return;
    try {
      await api(`/events/${id}/attendance`, { method: "POST", userId });
      setAttendMsg("Attendance recorded.");
    } catch {
      setAttendMsg("Could not record attendance.");
    }
  }

  if (detail.loading) return <div className="text-muted">Loading…</div>;
  if (detail.error) return <div className="text-red-400">Failed to load event.</div>;
  if (!detail.data) return null;

  const { event, sets, aggregate } = detail.data;
  const when = new Date(event.startsAt);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div>
          <div className="text-muted text-sm mb-2">
            {when.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{event.name}</h1>
          {event.venue && (
            <div className="text-muted mt-2">
              at{" "}
              <Link to={`/venues/${event.venue.id}`} className="hover:text-accent">
                {event.venue.name}
              </Link>{" "}
              · {event.venue.city}
            </div>
          )}
        </div>

        <div className="bg-panel border border-line rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <BigScore value={aggregate.overall} />
              <div className="text-xs text-muted mt-1">
                {aggregate.reviewCount} review{aggregate.reviewCount === 1 ? "" : "s"}
              </div>
            </div>
            {userId && (
              <button
                onClick={attend}
                className="text-sm px-3 py-1.5 rounded border border-line hover:border-accent"
              >
                I was there
              </button>
            )}
          </div>
          <ScoreBars dims={aggregate.dimensions} />
          {attendMsg && <div className="text-xs text-muted mt-3">{attendMsg}</div>}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Lineup</h2>
          {sets.length === 0 && <div className="text-muted text-sm">Lineup TBA.</div>}
          <div className="space-y-2">
            {sets.map((s) => (
              <Link
                key={s.id}
                to={`/sets/${s.id}`}
                className="flex items-center justify-between bg-panel border border-line rounded p-3 hover:border-accent"
              >
                <div className="flex items-center gap-3">
                  {s.isHeadliner && (
                    <span className="text-[10px] uppercase tracking-wider text-accent border border-accent px-1.5 py-0.5 rounded">
                      headliner
                    </span>
                  )}
                  <div className="font-medium">
                    {s.artists.map((a, i) => (
                      <span key={a.id}>
                        <Link
                          to={`/artists/${a.id}`}
                          className="hover:text-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.name}
                        </Link>
                        {i < s.artists.length - 1 && (
                          <span className="text-muted">
                            {" "}
                            {a.role === "b2b" ? "b2b" : "·"}{" "}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                {s.position != null && (
                  <span className="text-xs text-muted">#{s.position}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">
            Reviews ({reviews.data?.reviews.length ?? 0})
          </h2>
          <div className="space-y-3">
            {reviews.data?.reviews.map((r) => (
              <div key={r.id} className="bg-panel border border-line rounded p-4">
                <div className="flex gap-4 text-xs text-muted mb-2">
                  <span>M {r.music}</span>
                  <span>C {r.crowd}</span>
                  <span>P {r.production ?? "N/A"}</span>
                  <span>V {r.venue}</span>
                  <span className="ml-auto">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {r.text && <div className="text-sm">{r.text}</div>}
              </div>
            ))}
            {reviews.data && reviews.data.reviews.length === 0 && (
              <div className="text-muted text-sm">Be the first to review.</div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        {id && !reviews.loading && (
          (() => {
            const mine = userId
              ? reviews.data?.reviews.find((r) => r.userId === userId) ?? null
              : null;
            return (
              <ReviewForm
                key={mine?.id ?? "new"}
                eventId={id}
                existing={mine}
                onDone={() => {
                  detail.refresh();
                  reviews.refresh();
                }}
              />
            );
          })()
        )}
      </div>
    </div>
  );
}
