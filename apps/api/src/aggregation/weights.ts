// Weight profiles. v1: constants in this module (see architecture.md).
// A "profile" is a weighted projection of event dimensions onto an entity.
// The same shape supports future venue / brand scores with only a new profile.

export type Dim = "music" | "crowd" | "production" | "venue";

export type WeightProfile = Partial<Record<Dim, number>>;

export const ARTIST_WEIGHTS: WeightProfile = {
  music: 0.65,
  crowd: 0.15,
  production: 0.2,
};

// Designed-for, not surfaced in v1.
export const VENUE_WEIGHTS: WeightProfile = {
  venue: 0.5,
  crowd: 0.15,
  production: 0.2,
  music: 0.15,
};
