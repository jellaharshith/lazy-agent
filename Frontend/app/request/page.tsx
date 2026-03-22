"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageShell, SectionCard } from "@/components/ui/app-ui";

/**
 * Legacy route — seeker intake lives at `/request-food`.
 */
export default function RequestPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/request-food");
  }, [router]);

  return (
    <PageShell>
      <SectionCard className="text-center">
        <p className="text-sm text-slate-600">Redirecting to the main seeker flow...</p>
      </SectionCard>
    </PageShell>
  );
}
