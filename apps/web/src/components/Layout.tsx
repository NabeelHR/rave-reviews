import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useUser } from "../lib/user";

function UserBar() {
  const { userId, setUserId, isAdmin, setIsAdmin } = useUser();
  const [showLogin, setShowLogin] = useState(false);
  const [uid, setUid] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await api<{ user: { id: string } }>("/auth/signup", {
        method: "POST",
        body: { username: signupName, email: signupEmail },
      });
      setUserId(res.user.id);
      setShowLogin(false);
      setSignupName("");
      setSignupEmail("");
    } catch (e: any) {
      setErr(e?.body?.error ?? "signup failed");
    }
  }

  if (userId) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">signed in as</span>
        <code className="text-white/80 text-xs bg-panel px-2 py-1 rounded">
          {userId.slice(0, 8)}…
        </code>
        <label className="flex items-center gap-1 text-muted">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          admin
        </label>
        <button
          className="text-muted hover:text-white"
          onClick={() => setUserId(null)}
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="text-sm px-3 py-1.5 rounded bg-panel border border-line hover:border-accent"
        onClick={() => setShowLogin((s) => !s)}
      >
        sign in
      </button>
      {showLogin && (
        <div className="absolute right-0 mt-2 w-80 bg-panel border border-line rounded p-4 z-50 shadow-xl">
          <div className="mb-3">
            <div className="text-xs uppercase text-muted mb-1">Use existing user id</div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-ink border border-line rounded px-2 py-1 text-sm"
                placeholder="uuid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
              />
              <button
                className="text-sm px-2 py-1 rounded bg-accent"
                onClick={() => {
                  if (uid.trim()) {
                    setUserId(uid.trim());
                    setShowLogin(false);
                  }
                }}
              >
                use
              </button>
            </div>
          </div>
          <div className="border-t border-line my-3" />
          <form onSubmit={signup}>
            <div className="text-xs uppercase text-muted mb-1">Or sign up</div>
            <input
              className="w-full bg-ink border border-line rounded px-2 py-1 text-sm mb-2"
              placeholder="username"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
            />
            <input
              className="w-full bg-ink border border-line rounded px-2 py-1 text-sm mb-2"
              placeholder="email"
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />
            <button
              type="submit"
              className="w-full text-sm px-3 py-1.5 rounded bg-accent"
            >
              create account
            </button>
            {err && <div className="text-red-400 text-xs mt-2">{err}</div>}
          </form>
        </div>
      )}
    </div>
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

