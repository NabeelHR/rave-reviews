// One place that knows how to render a score, so every surface shows it the same
// way (consistency) — a single overall value, or the four-dimension breakdown.

export type Dims = {
  music: number | null;
  crowd: number | null;
  production: number | null;
  venue: number | null;
};

export const DIMENSIONS = [
  { key: "music", label: "Music" },
  { key: "crowd", label: "Crowd" },
  { key: "production", label: "Production" },
  { key: "venue", label: "Venue" },
] as const;

type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-5xl",
};

// A single overall score, e.g. "8.3 / 10". `—` when there's nothing to show.
export function Score({
  value,
  size = "md",
  showMax = true,
}: {
  value: number | null;
  size?: Size;
  showMax?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-bold tracking-tight tabular-nums ${SIZE_CLASS[size]}`}>
        {value == null ? "—" : value.toFixed(1)}
      </span>
      {showMax && <span className="text-muted text-sm">/ 10</span>}
    </span>
  );
}

// Compact per-dimension readout for a single review (Music/Crowd/Production/Venue).
export function DimensionScores({ dims }: { dims: Dims }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {DIMENSIONS.map((d) => (
        <span key={d.key} className="inline-flex items-baseline gap-1">
          <span className="text-muted">{d.label}</span>
          <span className="text-white/90 tabular-nums">
            {dims[d.key] == null ? "N/A" : dims[d.key]}
          </span>
        </span>
      ))}
    </div>
  );
}
