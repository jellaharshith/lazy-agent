"use client";

import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function MiniTrendCard({ title, subtitle, children, className }: Props) {
  return (
    <SectionCard className={cn("border-slate-200 shadow-[0_2px_12px_rgba(15,23,42,0.04)]", className)}>
      <h3 className="text-sm font-bold tracking-tight text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </SectionCard>
  );
}
