import { useState } from "react";
import { Link } from "react-router-dom";
import { Score } from "../components/Score";
import type { Event } from "../lib/api";
import { useFetch } from "../lib/useFetch";

function EventCard({ e }: { e: Event }) {
  const when = new Date(e.startsAt);
  const isUpcoming = when.getTime() > Date.now();
  return (
    <Link
      to={`/events/${e.id}`}
      className="block bg-panel border border-line rounded-lg p-4 hover:border-accent transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">
            {when.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-lg font-semibold leading-snug">{e.name}</div>
        </div>
        {e.score != null ? (
          <div className="text-accent shrink-0">
            <Score value={e.score} size="md" showMax={false} />
          </div>
        ) : isUpcoming ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-accent border border-accent rounded px-1.5 py-0.5">
            Upcoming
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-xs text-muted">
        {e.reviewCount
          ? `${e.reviewCount} review${e.reviewCount === 1 ? "" : "s"}`
          : isUpcoming
            ? "Upcoming show"
            : "No reviews yet"}
      </div>
    </Link>
  );
}

function CardGrid({ events }: { events: Event[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((e) => (
        <EventCard key={e.id} e={e} />
      ))}
    </div>
  );
}

function Section({ title, events }: { title: string; events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="text-sm uppercase tracking-wider text-muted mb-3">{title}</h2>
      <CardGrid events={events} />
    </section>
  );
}

export function DiscoveryPage() {
  const [status, setStatus] = useState<"" | "upcoming" | "past">("");
  const [q, setQ] = useState("");
  const { data, loading, error } = useFetch<{ events: Event[] }>(
    "/events",
    { status: status || undefined, q: q || undefined, limit: 50 },
    [status, q],
  );

  const now = Date.now();
  const events = data?.events ?? [];
  const upcoming = events
    .filter((e) => new Date(e.startsAt).getTime() >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)); // soonest first
  const past = events
    .filter((e) => new Date(e.startsAt).getTime() < now)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)); // most recent first

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Discover</h1>
        <p className="text-muted">
          Vancouver electronic music — the nights, the crowds, the rigs.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="bg-panel border border-line rounded px-3 py-2 text-sm flex-1 min-w-64"
          placeholder="Search events…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex bg-panel border border-line rounded overflow-hidden text-sm">
          {(["", "upcoming", "past"] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 ${
                status === s ? "bg-accent text-white" : "text-muted hover:text-white"
              }`}
            >
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-muted">Loading…</div>}
      {error && <div className="text-red-400">Failed to load: {error.status}</div>}
      {data && events.length === 0 && <div className="text-muted">No events match.</div>}

      {/* "all" splits into sections; a specific filter shows a single grid. */}
      {status === "" ? (
        <>
          <Section title="Upcoming" events={upcoming} />
          <Section title="Past" events={past} />
        </>
      ) : (
        <CardGrid events={events} />
      )}
    </div>
  );
}
