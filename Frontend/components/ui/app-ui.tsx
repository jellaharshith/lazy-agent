import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const ui = {
  shell:
    "mx-auto box-border w-full min-w-0 max-w-5xl px-3.5 py-6 sm:px-5 sm:py-9 md:px-6 md:py-11 lg:px-8 lg:py-14",
  sectionGap: "mt-4 sm:mt-8",
  title:
    "text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl",
  subtitle:
    "mt-1.5 max-w-3xl text-sm leading-snug text-slate-500 sm:mt-3 sm:text-base sm:leading-7",
  card: "box-border rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6 md:p-7",
  subCard: "box-border rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-5",
  mutedLabel:
    "inline-flex max-w-full items-center whitespace-normal break-words rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-[0.65rem] font-semibold uppercase leading-snug tracking-wider text-slate-500 shadow-sm sm:text-xs",
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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <span className="inline-flex max-w-full flex-wrap gap-2">
            <span className={ui.mutedLabel}>{eyebrow}</span>
          </span>
        ) : null}
        <h1 className={cn(ui.title, eyebrow ? "mt-2 sm:mt-3" : "", "break-words")}>
          {title}
        </h1>
        {subtitle ? <p className={cn(ui.subtitle, "break-words")}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {actions}
        </div>
      ) : null}
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
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm break-words sm:text-[0.9375rem]",
        tones[tone]
      )}
      {...props}
    >
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
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:px-8 sm:py-10">
      <p className="text-base font-semibold text-slate-900 sm:text-lg">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
        {description}
      </p>
      {action ? (
        <div className="mt-4 flex w-full min-w-0 flex-col items-stretch gap-2 sm:mt-6 sm:flex-row sm:items-center sm:justify-center sm:gap-3 [&_a]:min-h-11 [&_a]:w-full [&_a]:px-6 [&_a]:py-2.5 sm:[&_a]:w-auto [&_button]:min-h-11 [&_button]:w-full [&_button]:px-6 [&_button]:py-2.5 sm:[&_button]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}
