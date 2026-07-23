import { Link } from "react-router-dom";
import type { Review } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { useUser } from "../lib/user";

type Me = { user: { id: string; username: string; email: string } };
type Attendance = { attendance: { id: string; eventId: string; createdAt: string }[] };

export function MePage() {
  const { userId } = useUser();
  const me = useFetch<Me>(userId ? "/users/me" : null);
  const reviews = useFetch<{ reviews: Review[] }>(userId ? "/users/me/reviews" : null);
  const attend = useFetch<Attendance>(userId ? "/users/me/attendance" : null);

  if (!userId) {
    return <div className="text-muted">Sign in to see your activity.</div>;
  }
  if (me.loading) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{me.data?.user.username}</h1>
        <div className="text-muted text-sm">{me.data?.user.email}</div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Your reviews ({reviews.data?.reviews.length ?? 0})
        </h2>
        <div className="space-y-2">
          {reviews.data?.reviews.map((r) => (
            <Link
              key={r.id}
              to={`/events/${r.eventId}`}
              className="block bg-panel border border-line rounded p-3 hover:border-accent"
            >
              <div className="flex gap-4 text-xs text-muted">
                <span>M {r.music}</span>
                <span>C {r.crowd}</span>
                <span>P {r.production ?? "N/A"}</span>
                <span>V {r.venue}</span>
                <span className="ml-auto">
                  {new Date(r.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {r.text && <div className="text-sm mt-1">{r.text}</div>}
            </Link>
          ))}
          {reviews.data && reviews.data.reviews.length === 0 && (
            <div className="text-muted text-sm">No reviews yet.</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Attended ({attend.data?.attendance.length ?? 0})
        </h2>
        <div className="space-y-2">
          {attend.data?.attendance.map((a) => (
            <Link
              key={a.id}
              to={`/events/${a.eventId}`}
              className="block bg-panel border border-line rounded p-3 hover:border-accent text-sm"
            >
              <span className="text-muted">
                {new Date(a.createdAt).toLocaleDateString()} →{" "}
              </span>
              event {a.eventId.slice(0, 8)}…
            </Link>
          ))}
          {attend.data && attend.data.attendance.length === 0 && (
            <div className="text-muted text-sm">No attendance recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}
