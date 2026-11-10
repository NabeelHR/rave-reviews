import { DIMENSIONS, type Dims } from "./Score";

// The four-dimension breakdown as labeled bars (used for aggregates). Single-value
// and per-review readouts live in ./Score.
export function ScoreBars({ dims }: { dims: Dims }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {DIMENSIONS.map((d) => {
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
