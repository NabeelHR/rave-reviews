import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { useUser } from "../lib/user";

type SetResp = {
  set: { id: string; eventId: string; isHeadliner: boolean; position: number | null };
  artists: { id: string; name: string; role: string }[];
  rating: { count: number; average: number | null };
};

export function SetPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useUser();
  const set = useFetch<SetResp>(id ? `/sets/${id}` : null);
  const [score, setScore] = useState(8);
  const [msg, setMsg] = useState<string | null>(null);

  async function rate() {
    if (!id || !userId) return;
    setMsg(null);
    try {
      await api(`/sets/${id}/rating`, { method: "POST", userId, body: { score } });
      setMsg("Rating saved.");
      set.refresh();
    } catch (e) {
      const ae = e as ApiError;
      setMsg((ae.body as any)?.error ?? "failed");
    }
  }

  if (set.loading) return <div className="text-muted">Loading…</div>;
  if (!set.data) return <div className="text-muted">Not found.</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-1">
          {set.data.set.isHeadliner ? "Headliner set" : "Set"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {set.data.artists.map((a, i) => (
            <span key={a.id}>
              <Link to={`/artists/${a.id}`} className="hover:text-accent">
                {a.name}
              </Link>
              {i < set.data!.artists.length - 1 && (
                <span className="text-muted">
                  {" "}
                  {a.role === "b2b" ? "b2b" : "·"}{" "}
                </span>
              )}
            </span>
          ))}
        </h1>
        <div className="mt-2 text-sm">
          <Link to={`/events/${set.data.set.eventId}`} className="text-muted hover:text-accent">
            ← event
          </Link>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-lg p-5">
        <div className="text-sm text-muted mb-2">
          {set.data.rating.count} rating{set.data.rating.count === 1 ? "" : "s"}
        </div>
        <div className="text-3xl font-bold">
          {set.data.rating.average == null
            ? "—"
            : set.data.rating.average.toFixed(1)}
          <span className="text-muted text-sm font-normal"> / 10</span>
        </div>
      </div>

      {userId && (
        <div className="bg-panel border border-line rounded-lg p-5">
          <div className="text-sm font-semibold mb-2">Rate this set</div>
          <div className="text-xs text-muted mb-3">
            Requires attendance for the event.
          </div>
          <div className="flex gap-1 flex-wrap mb-3">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={`w-8 h-8 rounded text-xs border ${
                  score === n
                    ? "bg-accent border-accent"
                    : "bg-ink border-line hover:border-white/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={rate}
            className="px-4 py-2 rounded bg-accent text-sm font-medium"
          >
            Save rating
          </button>
          {msg && <div className="text-xs text-muted mt-2">{msg}</div>}
        </div>
      )}
    </div>
  );
}
