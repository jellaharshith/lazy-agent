"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ProviderResourceCard, type ProviderResourceRow } from "@/components/provider/ProviderResourceCard";
import { EmptyState, PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";

function ProviderResourcesContent() {
  const { session } = useAuth();
  const [resources, setResources] = useState<ProviderResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      setError("Sign in as a provider to see your listings.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/my/resources"), {
        headers: jsonHeaders(session),
      });
      const data = (await res.json()) as ProviderResourceRow[] | { error?: string };
      if (!res.ok) {
        setError(
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: string }).error)
            : "Could not load resources"
        );
        return;
      }
      setResources(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load your resources");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider"
        title="My resources"
        subtitle="Everything you’ve published for seekers to match and reserve."
        actions={
          <Link href="/add-resource" className={ui.primaryButton}>
            Add listing
          </Link>
        }
      />

      {error && (
        <div className={ui.sectionGap}>
          <StatusCard tone="warning">{error}</StatusCard>
        </div>
      )}

      {loading ? (
        <SectionCard className={ui.sectionGap}>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            Loading your listings…
          </div>
        </SectionCard>
      ) : resources.length === 0 ? (
        <SectionCard className={ui.sectionGap}>
          <EmptyState
            title="No listings yet"
            description="Add a surplus listing with quantity, pricing, and pickup location."
            action={
              <Link href="/add-resource" className={ui.primaryButton}>
                Add resource
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard className={ui.sectionGap}>
          <ul className="space-y-3">
            {resources.map((r) => (
              <ProviderResourceCard key={r.id} r={r} />
            ))}
          </ul>
        </SectionCard>
      )}
    </PageShell>
  );
}

export default function ProviderResourcesPage() {
  return (
    <RoleGuard allowedRoles={["provider"]}>
      <ProviderResourcesContent />
    </RoleGuard>
  );
}
