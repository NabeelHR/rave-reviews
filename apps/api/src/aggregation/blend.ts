import type { Dim, WeightProfile } from "./weights.js";

export type DimInputs = Partial<Record<Dim, number | null>>;

/**
 * Weighted blend of dimension averages against a profile.
 * Null/undefined inputs (e.g. N/A production) renormalize the remaining weights
 * rather than counting as zero — see product-decisions.md.
 * Returns null if no dimensions have inputs.
 */
export function blend(inputs: DimInputs, profile: WeightProfile): number | null {
  let weightSum = 0;
  let weighted = 0;
  for (const [dim, weight] of Object.entries(profile) as [Dim, number][]) {
    const value = inputs[dim];
    if (value == null) continue;
    weightSum += weight;
    weighted += weight * value;
  }
  if (weightSum === 0) return null;
  return weighted / weightSum;
}
