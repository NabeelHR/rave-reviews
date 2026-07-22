import { describe, expect, it } from "vitest";
import {
  ARTIST_WEIGHTS,
  aggregateArtist,
  aggregateEvent,
  blend,
} from "../src/aggregation/index.js";

describe("blend", () => {
  it("computes a weighted average against a profile", () => {
    const score = blend({ music: 10, crowd: 10, production: 10 }, ARTIST_WEIGHTS);
    expect(score).toBeCloseTo(10);
  });

  it("renormalizes when production is null (bare-warehouse case)", () => {
    // Music 10, Crowd 10, no production. Weights renormalize 65/15 → ~81/19.
    const score = blend({ music: 10, crowd: 10, production: null }, ARTIST_WEIGHTS);
    expect(score).toBeCloseTo(10);
  });

  it("does not silently zero absent production", () => {
    const withNull = blend({ music: 10, crowd: 5, production: null }, ARTIST_WEIGHTS);
    const asZero = 0.65 * 10 + 0.15 * 5 + 0.2 * 0;
    expect(withNull).not.toBeCloseTo(asZero);
  });

  it("returns null when nothing is present", () => {
    expect(blend({}, ARTIST_WEIGHTS)).toBeNull();
  });
});

describe("aggregateEvent", () => {
  it("averages each dimension, treating production nulls as absent (not zero)", () => {
    const agg = aggregateEvent([
      { music: 8, crowd: 8, production: 10, venue: 6 },
      { music: 9, crowd: 7, production: null, venue: 7 },
    ]);
    expect(agg.reviewCount).toBe(2);
    expect(agg.dimensions.music).toBeCloseTo(8.5);
    expect(agg.dimensions.production).toBeCloseTo(10);
    expect(agg.dimensions.venue).toBeCloseTo(6.5);
  });

  it("handles no reviews", () => {
    const agg = aggregateEvent([]);
    expect(agg.overall).toBeNull();
    expect(agg.dimensions.music).toBeNull();
  });
});

describe("aggregateArtist", () => {
  it("blends inherited Music + set ratings, and event Crowd/Production", () => {
    const score = aggregateArtist(
      [{ eventMusic: 8, eventCrowd: 9, eventProduction: 7 }],
      [9], // one set rating
    );
    // Music input = mean(8, 9) = 8.5
    // Blend = 0.65*8.5 + 0.15*9 + 0.2*7 = 5.525 + 1.35 + 1.4 = 8.275
    expect(score.score).toBeCloseTo(8.275);
    expect(score.breakdown.music).toBeCloseTo(8.5);
  });

  it("renormalizes when the artist's headlined events have no production", () => {
    const score = aggregateArtist(
      [{ eventMusic: 10, eventCrowd: 10, eventProduction: null }],
      [],
    );
    // Music 10, Crowd 10, production absent → renormalize over 65/15 → still 10
    expect(score.score).toBeCloseTo(10);
  });

  it("returns null score for an artist with no inputs", () => {
    const score = aggregateArtist([], []);
    expect(score.score).toBeNull();
  });
});
