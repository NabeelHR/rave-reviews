import { useState } from "react";
import { Link } from "react-router-dom";
import type { Event } from "../lib/api";
import { useFetch } from "../lib/useFetch";

function EventCard({ e }: { e: Event }) {
  const when = new Date(e.startsAt);
  return (
    <Link
      to={`/events/${e.id}`}
      className="block bg-panel border border-line rounded-lg p-4 hover:border-accent transition"
    >
      <div className="text-xs uppercase tracking-wider text-muted mb-1">
        {when.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className="text-lg font-semibold">{e.name}</div>
    </Link>
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
      {data && data.events.length === 0 && (
        <div className="text-muted">No events match.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.events.map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}
