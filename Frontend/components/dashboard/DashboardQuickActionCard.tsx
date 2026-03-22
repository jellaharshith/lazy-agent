import Link from "next/link";
import type { ReactNode } from "react";
import { SectionCard, ui } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils";

export function DashboardQuickActionCard({
  kicker,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  footer,
  accent,
}: {
  kicker: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  footer?: ReactNode;
  accent?: boolean;
}) {
  return (
    <SectionCard
      className={cn(
        "flex h-full flex-col justify-between",
        accent && "border-l-[3px] border-l-slate-900 shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kicker}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={primaryHref}
          className={ui.primaryButton + " w-full justify-center py-3 text-sm sm:w-auto sm:min-w-[10rem]"}
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className={ui.secondaryButton + " w-full justify-center py-3 text-sm sm:w-auto sm:min-w-[10rem]"}
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
      {footer ? <div className="mt-4 border-t border-slate-100 pt-4">{footer}</div> : null}
    </SectionCard>
  );
}
