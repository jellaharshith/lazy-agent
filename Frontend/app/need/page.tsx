import Link from "next/link";
import { PageHeader, PageShell, SectionCard, ui } from "@/components/ui/app-ui";

export default function NeedPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Seeker flow"
        title="You are in the right place"
        subtitle="Describe your situation in one sentence and we will look for nearby food support."
      />

      <SectionCard className={ui.sectionGap}>
        <p className="text-sm leading-6 text-slate-700">
          Continue to describe what you need in one sentence. We will look for nearby food support and show matches when
          available.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/request-food" className={ui.primaryButton}>
            Continue to request food
          </Link>
          <Link href="/" className={ui.secondaryButton}>
            Back to home
          </Link>
        </div>
      </SectionCard>
    </PageShell>
  );
}
