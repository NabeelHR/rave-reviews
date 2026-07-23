import { useParams } from "react-router-dom";
import { useFetch } from "../lib/useFetch";

type UserResp = {
  user: { id: string; username: string; createdAt: string };
  stats: { reviewCount: number };
};

export function UserPage() {
  const { id } = useParams<{ id: string }>();
  const user = useFetch<UserResp>(id ? `/users/${id}` : null);

  if (user.loading) return <div className="text-muted">Loading…</div>;
  if (!user.data) return <div className="text-muted">Not found.</div>;

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{user.data.user.username}</h1>
      <div className="text-muted text-sm">
        Joined {new Date(user.data.user.createdAt).toLocaleDateString()} ·{" "}
        {user.data.stats.reviewCount} review
        {user.data.stats.reviewCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
