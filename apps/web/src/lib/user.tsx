import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Iteration-1 user stub: we hold a userId in localStorage and inject it into
// every request as X-User-Id (matching the API's requireUser middleware).
// Real auth lands in iteration 2.

type UserCtx = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
};

const Ctx = createContext<UserCtx | null>(null);
const USER_KEY = "rr.userId";
const ADMIN_KEY = "rr.admin";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(
    () => localStorage.getItem(USER_KEY),
  );
  const [isAdmin, setIsAdminState] = useState<boolean>(
    () => localStorage.getItem(ADMIN_KEY) === "true",
  );

  useEffect(() => {
    if (userId) localStorage.setItem(USER_KEY, userId);
    else localStorage.removeItem(USER_KEY);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(ADMIN_KEY, String(isAdmin));
  }, [isAdmin]);

  const value = useMemo<UserCtx>(
    () => ({
      userId,
      setUserId: setUserIdState,
      isAdmin,
      setIsAdmin: setIsAdminState,
    }),
    [userId, isAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside <UserProvider>");
  return v;
}
