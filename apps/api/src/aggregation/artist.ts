import { blend } from "./blend.js";
import { ARTIST_WEIGHTS, type Dim } from "./weights.js";

// Music-only inheritance: only the Music dim of headlined events flows to the artist.
// Crowd/Production from headlined events also feed in (per the blend weights) but
// come from the *event* aggregate, not from any per-artist score.
export type HeadlinedEventInput = {
  eventMusic: number | null;
  eventCrowd: number | null;
  eventProduction: number | null;
};

export type ArtistScore = {
  score: number | null; // the blended number
  breakdown: Record<Dim, number | null>;
  inputs: {
    headlinedEventCount: number;
    setRatingCount: number;
  };
};

function mean(xs: (number | null)[]): number | null {
  const present = xs.filter((x): x is number => x != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

export function aggregateArtist(
  headlined: HeadlinedEventInput[],
  setRatings: number[],
): ArtistScore {
  // Music input: inherited event Music + explicit set ratings, averaged together.
  const musicInputs: number[] = [];
  for (const e of headlined) if (e.eventMusic != null) musicInputs.push(e.eventMusic);
  for (const s of setRatings) musicInputs.push(s);
  const music = musicInputs.length === 0 ? null : mean(musicInputs);

  const crowd = mean(headlined.map((e) => e.eventCrowd));
  const production = mean(headlined.map((e) => e.eventProduction));

  const breakdown = { music, crowd, production, venue: null };
  const score = blend({ music, crowd, production }, ARTIST_WEIGHTS);

  return {
    score,
    breakdown,
    inputs: {
      headlinedEventCount: headlined.length,
      setRatingCount: setRatings.length,
    },
  };
}
