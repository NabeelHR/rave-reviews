import { Link, useParams } from "react-router-dom";
import type { Event, Venue } from "../lib/api";
import { useFetch } from "../lib/useFetch";

export function VenuePage() {
  const { id } = useParams<{ id: string }>();
  const venue = useFetch<{ venue: Venue }>(id ? `/venues/${id}` : null);
  const events = useFetch<{ events: Event[] }>(id ? `/venues/${id}/events` : null);

  if (venue.loading) return <div className="text-muted">Loading…</div>;
  if (!venue.data) return <div className="text-muted">Not found.</div>;
  const v = venue.data.venue;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{v.name}</h1>
        <div className="text-muted mt-1">
          {v.city}
          {v.region ? `, ${v.region}` : ""} · {v.country}
          {v.capacity != null && ` · cap ${v.capacity}`}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Events</h2>
        <div className="space-y-2">
          {events.data?.events.map((e) => (
            <Link
              key={e.id}
              to={`/events/${e.id}`}
              className="block bg-panel border border-line rounded p-3 hover:border-accent"
            >
              <div className="text-xs text-muted mb-1">
                {new Date(e.startsAt).toLocaleDateString()}
              </div>
              <div className="font-medium">{e.name}</div>
            </Link>
          ))}
          {events.data && events.data.events.length === 0 && (
            <div className="text-muted text-sm">No events yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
