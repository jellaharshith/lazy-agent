"use client";

import type { ReactNode } from "react";
import { ui } from "@/components/ui/app-ui";

export type ProviderResourceRow = {
  id: string;
  title: string;
  resource_type?: string | null;
  category?: string | null;
  quantity: number | null;
  original_price?: number | null;
  discounted_price?: number | null;
  expires_at: string | null;
  status: string;
};

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function formatExpires(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

export function ProviderResourceCard({ r }: { r: ProviderResourceRow }) {
  return (
    <li className={ui.subCard + " text-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="pr-2 text-lg font-semibold leading-snug text-slate-900">{r.title}</p>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 ring-1 ring-slate-200">
          {r.status}
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 divide-y divide-slate-100">
        <DataRow label="Quantity" value={r.quantity ?? "—"} />
        <DataRow label="Original price" value={formatMoney(r.original_price)} />
        <DataRow label="Discounted price" value={formatMoney(r.discounted_price)} />
        <DataRow label="Expires" value={formatExpires(r.expires_at)} />
      </div>
    </li>
  );
}
