import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useUser } from "../lib/user";

function UserBar() {
  const { user, loading, logout } = useUser();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="text-sm text-muted">…</div>;

  if (user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">signed in as</span>
        <span className="text-white/90">{user.username}</span>
        {user.isAdmin && (
          <span className="text-[10px] uppercase tracking-wider text-accent border border-accent px-1.5 py-0.5 rounded">
            admin
          </span>
        )}
        <button className="text-muted hover:text-white" onClick={() => logout()}>
          sign out
        </button>
      </div>
    );
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Always 200 (invite-only, no existence leak), so just confirm it was sent.
      await api("/auth/request-link", { method: "POST", body: { email } });
      setSent(true);
    } catch {
      setErr("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <span className="text-sm text-muted">
        Check your email for a sign-in link.
      </span>
    );
  }

  return (
    <form onSubmit={sendLink} className="flex items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="bg-ink border border-line rounded px-2 py-1 text-sm w-44"
      />
      <button
        type="submit"
        disabled={busy}
        className="text-sm px-3 py-1.5 rounded bg-accent disabled:opacity-50"
      >
        {busy ? "…" : "Email me a link"}
      </button>
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </form>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
          <Link to="/" className="font-bold text-lg tracking-tight">
            rave<span className="text-accent">.reviews</span>
          </Link>
          <nav className="flex gap-6 text-sm text-muted">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "text-white" : "hover:text-white transition"
              }
              end
            >
              discover
            </NavLink>
            <NavLink
              to="/me"
              className={({ isActive }) =>
                isActive ? "text-white" : "hover:text-white transition"
              }
            >
              me
            </NavLink>
          </nav>
          <div className="ml-auto">
            <UserBar />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

