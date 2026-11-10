import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

// Session-based identity (RR-3). The httpOnly session cookie is the source of
// truth; we learn who we are by calling /users/me. No localStorage, no headers.

type Me = { id: string; username: string; email: string; isAdmin: boolean };

type UserCtx = {
  user: Me | null;
  userId: string | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<UserCtx | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: Me }>("/users/me");
      setUser(res.user);
    } catch {
      setUser(null); // 401 when not signed in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
  }, []);

  const value = useMemo<UserCtx>(
    () => ({
      user,
      userId: user?.id ?? null,
      isAdmin: user?.isAdmin ?? false,
      loading,
      refresh,
      logout,
    }),
    [user, loading, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside <UserProvider>");
  return v;
}
