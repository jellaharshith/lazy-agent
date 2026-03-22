"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ProviderResourceCard, type ProviderResourceRow } from "@/components/provider/ProviderResourceCard";
import { EmptyState, PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";

const DEFAULT_LAT = 37.6688;
const DEFAULT_LNG = -122.0808;

const RESOURCE_TYPES = ["food", "bakery", "produce", "prepared", "other"] as const;

function AddResourceContent() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState<string>("food");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [lat, setLat] = useState(String(DEFAULT_LAT));
  const [lng, setLng] = useState(String(DEFAULT_LNG));
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [resources, setResources] = useState<ProviderResourceRow[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [success]);

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setError("Could not read your location. Enter lat/lng manually.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 }
    );
  }

  const loadMyResources = useCallback(async () => {
    if (!session?.access_token) {
      setListLoading(false);
      setListError("Sign in to load your listings.");
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(apiUrl("/api/my/resources"), {
        headers: jsonHeaders(session),
      });
      const data = (await res.json()) as ProviderResourceRow[] | { error?: string };
      if (!res.ok) {
        setListError(
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: string }).error)
            : "Could not load resources"
        );
        return;
      }
      setResources(Array.isArray(data) ? data : []);
    } catch {
      setListError("Could not load your resources");
    } finally {
      setListLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadMyResources();
  }, [loadMyResources]);

  function resetForm() {
    setTitle("");
    setResourceType("food");
    setCategory("");
    setQuantity("");
    setOriginalPrice("");
    setDiscountedPrice("");
    setExpiresAt("");
    setLat(String(DEFAULT_LAT));
    setLng(String(DEFAULT_LNG));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!session?.access_token) {
      setError("You must be signed in as a provider.");
      return;
    }
    if (!quantity.trim()) {
      setError("Quantity is required.");
      return;
    }
    const q = Number.parseInt(quantity, 10);
    if (!Number.isFinite(q) || !Number.isInteger(q)) {
      setError("Quantity must be a whole number.");
      return;
    }
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setError("Latitude and longitude must be valid numbers.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        resource_type: resourceType.trim() || "food",
        quantity: q,
        lat: latN,
        lng: lngN,
      };
      if (category.trim()) body.category = category.trim();
      if (originalPrice.trim()) {
        const v = Number.parseFloat(originalPrice);
        if (Number.isFinite(v)) body.original_price = v;
      }
      if (discountedPrice.trim()) {
        const v = Number.parseFloat(discountedPrice);
        if (Number.isFinite(v)) body.discounted_price = v;
      }
      if (expiresAt.trim()) {
        body.expires_at = new Date(expiresAt).toISOString();
      }

      const res = await fetch(apiUrl("/api/resources"), {
        method: "POST",
        headers: jsonHeaders(session),
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      setSuccess("Your listing was published successfully.");
      resetForm();
      await loadMyResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider"
        title="Add surplus listing"
        subtitle="Publish surplus with quantity, pricing, pickup window, and location — same layout cues as the seeker request flow."
      />

      <SectionCard className={ui.sectionGap}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={ui.fieldLabel}>Title</label>
            <p className="mt-0.5 text-xs text-slate-400">What are you offering?</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={ui.input + " mt-2"}
              placeholder="e.g. Assorted sandwiches — end of day"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ui.fieldLabel}>
              Category / type
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className={ui.input}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.fieldLabel}>
              Label (optional)
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={ui.input}
                placeholder="e.g. Indian, vegan"
              />
            </label>
          </div>

          <label className={ui.fieldLabel}>
            Quantity
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={ui.input}
              required
              placeholder="How many units?"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ui.fieldLabel}>
              Original price ($)
              <input
                type="number"
                step="0.01"
                min={0}
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className={ui.input}
                placeholder="Optional"
              />
            </label>
            <label className={ui.fieldLabel}>
              Discounted price ($)
              <input
                type="number"
                step="0.01"
                min={0}
                value={discountedPrice}
                onChange={(e) => setDiscountedPrice(e.target.value)}
                className={ui.input}
                placeholder="Optional"
              />
            </label>
          </div>

          <label className={ui.fieldLabel}>
            Expires / pickup deadline
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={ui.input}
            />
          </label>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <span className={ui.fieldLabel}>Pickup location</span>
                <p className="mt-0.5 text-xs text-slate-400">Lat and lng for the map and distance match.</p>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                className={ui.secondaryButton + " py-1.5 text-xs"}
              >
                {geoLoading ? "Locating…" : "Use my location"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <label className={ui.fieldLabel}>
                Latitude
                <input value={lat} onChange={(e) => setLat(e.target.value)} required className={ui.input} />
              </label>
              <label className={ui.fieldLabel}>
                Longitude
                <input value={lng} onChange={(e) => setLng(e.target.value)} required className={ui.input} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={loading} className={ui.primaryButton + " w-full justify-center py-3 text-base sm:w-auto"}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Publishing…
              </span>
            ) : (
              "Publish listing"
            )}
          </button>

          {success && (
            <div ref={successRef} className="scroll-mt-24 pt-2">
              <StatusCard tone="success">
                <p className="font-medium">{success}</p>
              </StatusCard>
            </div>
          )}
          {error && (
            <div className="pt-2">
              <StatusCard tone="danger">{error}</StatusCard>
            </div>
          )}
        </form>
      </SectionCard>

      <SectionCard className={ui.sectionGap}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your listings</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Recent</h2>
          </div>
          <Link
            href="/provider/resources"
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
          >
            Full list →
          </Link>
        </div>
        {listError && (
          <div className="mt-4">
            <StatusCard tone="warning">{listError}</StatusCard>
          </div>
        )}
        {listLoading ? (
          <p className="mt-4 text-sm text-slate-600">Loading your listings…</p>
        ) : resources.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No listings yet"
              description="Publish your first surplus item using the form above."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {resources.map((r) => (
              <ProviderResourceCard key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}

export default function AddResourcePage() {
  return (
    <RoleGuard allowedRoles={["provider"]}>
      <AddResourceContent />
    </RoleGuard>
  );
}
