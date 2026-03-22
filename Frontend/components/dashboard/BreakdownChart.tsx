"use client";

import { cn } from "@/lib/utils";

export type BreakdownDatum = { label: string; value: number };

type Props = {
  data: BreakdownDatum[];
  barClassName?: string;
  emptyHint?: string;
};

export function BreakdownChart({
  data,
  barClassName = "bg-slate-700/75",
  emptyHint = "Add categories on listings to see a breakdown.",
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
    <ul className="space-y-2.5" role="list" aria-label="Breakdown">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2 text-sm">
          <span className="min-w-0 truncate font-medium text-slate-700" title={d.label}>
            {d.label}
          </span>
          <div className="h-2 min-w-0 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-[width] duration-300", barClassName)}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}
