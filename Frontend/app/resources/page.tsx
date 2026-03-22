import Link from "next/link";
import { PageHeader, PageShell, SectionCard, ui } from "@/components/ui/app-ui";

export default function ResourcesPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider flow"
        title="Put surplus food to work"
        subtitle="List available meals and supplies so nearby seekers can be matched quickly."
      />

      <SectionCard className={ui.sectionGap}>
        <p className="text-sm leading-6 text-slate-700">
          Add a resource in under a minute and keep your provider list updated in real time.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/add-resource" className={ui.primaryButton}>
            Add a resource
          </Link>
          <Link href="/provider" className={ui.secondaryButton}>
            Provider home
          </Link>
        </div>
      </SectionCard>
    </PageShell>
  );
}
