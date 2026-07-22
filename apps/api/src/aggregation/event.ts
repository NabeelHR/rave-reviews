import type { Dim } from "./weights.js";

export type ReviewRow = {
  music: number;
  crowd: number;
  production: number | null;
  venue: number;
};

export type EventAggregate = {
  reviewCount: number;
  dimensions: Record<Dim, number | null>;
  // Unweighted mean across the 4 dimensions (with N/A production renormalized).
  overall: number | null;
};

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function aggregateEvent(reviews: ReviewRow[]): EventAggregate {
  const music = mean(reviews.map((r) => r.music));
  const crowd = mean(reviews.map((r) => r.crowd));
  const production = mean(
    reviews.filter((r) => r.production != null).map((r) => r.production as number),
  );
  const venue = mean(reviews.map((r) => r.venue));

  const present = [music, crowd, production, venue].filter((v): v is number => v != null);
  const overall = present.length === 0 ? null : present.reduce((a, b) => a + b, 0) / present.length;

  return {
    reviewCount: reviews.length,
    dimensions: { music, crowd, production, venue },
    overall,
  };
}
