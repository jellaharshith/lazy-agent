"use client";

import { cn } from "@/lib/utils";

export type MiniBarDatum = { label: string; value: number };

type Props = {
  data: MiniBarDatum[];
  /** Tailwind classes for the bar fill */
  barClassName?: string;
  emptyHint?: string;
};

export function MiniBarChart({
  data,
  barClassName = "bg-emerald-500/85",
  emptyHint = "No samples in this window yet.",
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-8 text-center text-xs text-slate-500">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="flex min-h-[7.5rem] items-end justify-between gap-1 sm:gap-2" role="img" aria-label="Bar chart">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums text-slate-700">{d.value}</span>
            <div className="flex h-24 w-full max-w-[2.75rem] sm:max-w-[3.25rem] items-end justify-center self-center">
              <div
                className={cn("w-full rounded-t-md shadow-sm transition-[height] duration-300", barClassName)}
                style={{
                  height: `${pct}%`,
                  minHeight: d.value === 0 ? 2 : 6,
                }}
              />
            </div>
            <span
              className="max-w-full truncate text-center text-[10px] font-medium leading-tight text-slate-500 sm:text-xs"
              title={d.label}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
