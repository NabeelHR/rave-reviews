import { Link, useParams } from "react-router-dom";
import { BigScore, ScoreBars } from "../components/ScoreBars";
import type { Artist, ArtistScore } from "../lib/api";
import { useFetch } from "../lib/useFetch";

type SetsResp = {
  sets: {
    setId: string;
    isHeadliner: boolean;
    role: string;
    eventId: string;
    eventName: string;
    startsAt: string;
  }[];
};

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const artist = useFetch<{ artist: Artist; score: ArtistScore }>(
    id ? `/artists/${id}` : null,
  );
  const sets = useFetch<SetsResp>(id ? `/artists/${id}/sets` : null);

  if (artist.loading) return <div className="text-muted">Loading…</div>;
  if (!artist.data) return <div className="text-muted">Not found.</div>;
  const { artist: a, score } = artist.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{a.name}</h1>
        <div className="text-muted mt-1 text-sm">
          {score.inputs.headlinedEventCount} headlined event
          {score.inputs.headlinedEventCount === 1 ? "" : "s"} ·{" "}
          {score.inputs.setRatingCount} set rating
          {score.inputs.setRatingCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="bg-panel border border-line rounded-lg p-5">
        <BigScore value={score.score} />
        <div className="mt-4">
          <ScoreBars dims={score.breakdown} />
        </div>
        <div className="text-xs text-muted mt-3">
          Blended: 65% Music, 15% Crowd, 20% Production (renormalized when Production
          is N/A). Venue not part of the artist blend.
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Sets</h2>
        <div className="space-y-2">
          {sets.data?.sets.map((s) => (
            <Link
              key={s.setId}
              to={`/events/${s.eventId}`}
              className="flex items-center justify-between bg-panel border border-line rounded p-3 hover:border-accent"
            >
              <div>
                <div className="font-medium">{s.eventName}</div>
                <div className="text-xs text-muted">
                  {new Date(s.startsAt).toLocaleDateString()} ·{" "}
                  {s.role === "b2b" ? "b2b" : s.role}
                </div>
              </div>
              {s.isHeadliner && (
                <span className="text-[10px] uppercase tracking-wider text-accent border border-accent px-1.5 py-0.5 rounded">
                  headliner
                </span>
              )}
            </Link>
          ))}
          {sets.data && sets.data.sets.length === 0 && (
            <div className="text-muted text-sm">No sets on record.</div>
          )}
        </div>
      </div>
    </div>
  );
}
