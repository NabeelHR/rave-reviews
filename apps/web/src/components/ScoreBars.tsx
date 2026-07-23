const DIMS = [
  { key: "music", label: "Music" },
  { key: "crowd", label: "Crowd" },
  { key: "production", label: "Production" },
  { key: "venue", label: "Venue" },
] as const;

type Dims = { music: number | null; crowd: number | null; production: number | null; venue: number | null };

export function ScoreBars({ dims }: { dims: Dims }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {DIMS.map((d) => {
        const v = dims[d.key];
        const pct = v == null ? 0 : (v / 10) * 100;
        return (
          <div key={d.key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted">{d.label}</span>
              <span className="text-white/80">{v == null ? "N/A" : v.toFixed(1)}</span>
            </div>
            <div className="h-1.5 bg-line rounded overflow-hidden">
              <div
                className={v == null ? "" : "h-full bg-accent"}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BigScore({ value }: { value: number | null }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-5xl font-bold tracking-tight">
        {value == null ? "—" : value.toFixed(1)}
      </span>
      <span className="text-muted text-sm">/ 10</span>
    </div>
  );
}
