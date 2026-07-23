// Thin fetch wrapper. Auth headers injected by callers via `opts.userId`/`opts.admin`
// so hooks stay in React-land and this file stays framework-free.

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`api ${status}`);
  }
}

type Opts = {
  method?: string;
  body?: unknown;
  userId?: string | null;
  admin?: boolean;
  query?: Record<string, string | number | undefined | null>;
};

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.userId) headers["x-user-id"] = opts.userId;
  if (opts.admin) headers["x-admin"] = "true";

  let url = BASE + path;
  if (opts.query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    }
    const s = q.toString();
    if (s) url += `?${s}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

// ---------- Types (shape only — kept loose to match server response) ----------

export type Venue = {
  id: string;
  name: string;
  city: string;
  region: string | null;
  country: string;
  capacity: number | null;
};

export type Event = {
  id: string;
  name: string;
  venueId: string;
  startsAt: string;
  endsAt: string | null;
};

export type Artist = { id: string; name: string; canonicalName: string };

export type SetRow = {
  id: string;
  isHeadliner: boolean;
  position: number | null;
  startsAt: string | null;
  artists: { id: string; name: string; role: string }[];
};

export type Review = {
  id: string;
  userId: string;
  eventId: string;
  music: number;
  crowd: number;
  production: number | null;
  venue: number;
  text: string | null;
  updatedAt: string;
};

export type EventAggregate = {
  reviewCount: number;
  dimensions: {
    music: number | null;
    crowd: number | null;
    production: number | null;
    venue: number | null;
  };
  overall: number | null;
};

export type ArtistScore = {
  score: number | null;
  breakdown: {
    music: number | null;
    crowd: number | null;
    production: number | null;
    venue: number | null;
  };
  inputs: { headlinedEventCount: number; setRatingCount: number };
};
