import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { useUser } from "./user";

type State<T> = { data: T | null; error: ApiError | null; loading: boolean };

// Minimal data-fetching hook. React Query would be nicer at scale; iteration 1
// doesn't need cache invalidation beyond a manual `refresh` bump.
export function useFetch<T>(
  path: string | null,
  query?: Record<string, string | number | undefined | null>,
  deps: unknown[] = [],
) {
  const { userId } = useUser();
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: !!path });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    api<T>(path, { query, userId })
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch(
        (err) =>
          !cancelled && setState({ data: null, error: err as ApiError, loading: false }),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}
