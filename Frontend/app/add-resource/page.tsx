"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ProviderResourceCard, type ProviderResourceRow } from "@/components/provider/ProviderResourceCard";
import { EmptyState, PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";

const RESOURCE_TYPES = ["food", "bakery", "produce", "prepared", "other"] as const;

type LocationPin = { lat: number; lng: number; display_name: string };

function AddResourceContent() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState<string>("food");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pin, setPin] = useState<LocationPin | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [resources, setResources] = useState<ProviderResourceRow[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [success]);

  async function handleLookupAddress() {
    if (!session?.access_token) {
      setError("You must be signed in to look up an address.");
      return;
    }
    const q = pickupAddress.trim();
    if (!q) {
      setError("Enter a street address or place name, then look it up.");
      return;
    }
    setLookupLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/geocode/forward"), {
        method: "POST",
        headers: jsonHeaders(session),
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as LocationPin & { error?: string };
      if (!res.ok) {
        setPin(null);
        setError(data.error ?? "Could not find that address.");
        return;
      }
      if (
        typeof data.lat !== "number" ||
        typeof data.lng !== "number" ||
        typeof data.display_name !== "string"
      ) {
        setPin(null);
        setError("Unexpected response from geocoder.");
        return;
      }
      setPin({ lat: data.lat, lng: data.lng, display_name: data.display_name });
      setPickupAddress(data.display_name);
    } catch {
      setPin(null);
      setError("Address lookup failed. Check your connection and try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    if (!session?.access_token) {
      setError("You must be signed in to use your location.");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        try {
          const res = await fetch(apiUrl("/api/geocode/reverse"), {
            method: "POST",
            headers: jsonHeaders(session),
            body: JSON.stringify({ lat: la, lng: ln }),
          });
          const data = (await res.json()) as LocationPin & { error?: string };
          if (!res.ok) {
            setPin({ lat: la, lng: ln, display_name: `${la.toFixed(5)}, ${ln.toFixed(5)}` });
            setPickupAddress("");
            setError(data.error ?? "Could not resolve address; coordinates are still saved for the listing.");
            setGeoLoading(false);
            return;
          }
          if (
            typeof data.lat !== "number" ||
            typeof data.lng !== "number" ||
            typeof data.display_name !== "string"
          ) {
            setPin({ lat: la, lng: ln, display_name: `${la.toFixed(5)}, ${ln.toFixed(5)}` });
          } else {
            setPin({ lat: data.lat, lng: data.lng, display_name: data.display_name });
            setPickupAddress(data.display_name);
          }
        } catch {
          setPin({ lat: la, lng: ln, display_name: `${la.toFixed(5)}, ${ln.toFixed(5)}` });
          setPickupAddress("");
          setError("Could not resolve address; coordinates from your device are still saved.");
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setError("Could not read your location. Try entering an address instead.");
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
    setPickupAddress("");
    setPin(null);
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
    if (!pin) {
      setError('Set pickup location: enter an address and click "Look up address", or use "Use my location".');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        resource_type: resourceType.trim() || "food",
        quantity: q,
        lat: pin.lat,
        lng: pin.lng,
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
                <p className="mt-0.5 text-xs text-slate-400">
                  Street address or place name. We convert it to a map pin for distance matching.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading || lookupLoading}
                className={ui.secondaryButton + " py-1.5 text-xs"}
              >
                {geoLoading ? "Locating…" : "Use my location"}
              </button>
            </div>
            <label className="mt-2 block">
              <span className={ui.fieldLabel}>Address</span>
              <textarea
                value={pickupAddress}
                onChange={(e) => {
                  setPickupAddress(e.target.value);
                  setPin(null);
                }}
                rows={2}
                className={ui.input + " mt-2 min-h-[4.5rem] resize-y"}
                placeholder="e.g. 777 B St, Hayward, CA 94541"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleLookupAddress()}
                disabled={lookupLoading || geoLoading || !pickupAddress.trim()}
                className={ui.secondaryButton + " py-1.5 text-xs"}
              >
                {lookupLoading ? "Looking up…" : "Look up address"}
              </button>
            </div>
            {pin && (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Pinned:</span> {pin.display_name}
              </p>
            )}
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
