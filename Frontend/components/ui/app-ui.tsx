import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const ui = {
  shell: "mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14",
  sectionGap: "mt-8",
  title: "text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl",
  subtitle: "mt-3 max-w-3xl text-base leading-7 text-slate-500",
  card: "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-7",
  subCard: "rounded-xl border border-slate-200 bg-slate-50 p-4",
  mutedLabel:
    "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 shadow-sm",
  primaryButton:
    "inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[.98]",
  input:
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
  textarea:
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
  fieldLabel: "block text-sm font-semibold text-slate-700",
};

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn(ui.shell, className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? <span className={ui.mutedLabel}>{eyebrow}</span> : null}
        <h1 className={cn(ui.title, eyebrow ? "mt-3" : "")}>{title}</h1>
        {subtitle ? <p className={ui.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </header>
  );
}

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(ui.card, className)}>{children}</section>;
}

export function StatusCard({
  children,
  tone = "neutral",
  ...props
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
} & HTMLAttributes<HTMLDivElement>) {
  const tones: Record<typeof tone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-sm", tones[tone])} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
