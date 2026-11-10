import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useUser } from "../lib/user";

// Lands here from the magic link (APP_URL/auth/callback?token=…). Posts the token
// to exchange it for a session, then sends the user home. The token is single-use,
// so we guard against React StrictMode's double effect invocation.
export function CallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useUser();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get("token");
    if (!token) {
      setFailed(true);
      return;
    }
    (async () => {
      try {
        await api("/auth/callback", { method: "POST", body: { token } });
        await refresh();
        navigate("/", { replace: true });
      } catch {
        setFailed(true);
      }
    })();
  }, [params, refresh, navigate]);

  return (
    <div className="text-muted">
      {failed
        ? "That sign-in link is invalid or expired — request a new one."
        : "Signing you in…"}
    </div>
  );
}
