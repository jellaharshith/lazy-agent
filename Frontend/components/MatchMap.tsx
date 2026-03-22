"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const containerStyle = {
  width: "100%",
  height: "320px",
  borderRadius: "0.75rem",
};

export type LatLng = { lat: number; lng: number };

export type MatchMapProps = {
  userLocation: LatLng;
  matchLocation: LatLng;
  matchTitle?: string;
};

export default function MatchMap({
  userLocation,
  matchLocation,
  matchTitle,
}: MatchMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [authFailed, setAuthFailed] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "match-map-loader",
    googleMapsApiKey: apiKey,
    version: "weekly",
    // Sends only the page origin as Referer — helps HTTP-referrer key rules match localhost ports.
    authReferrerPolicy: "origin",
  });

  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      setAuthFailed(true);
      previous?.();
    };
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);

  const mapRef = useRef<google.maps.Map | null>(null);

  const fitBoth = useCallback(
    (map: google.maps.Map) => {
      const same =
        userLocation.lat === matchLocation.lat &&
        userLocation.lng === matchLocation.lng;

      if (same) {
        map.setCenter(userLocation);
        map.setZoom(15);
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userLocation);
      bounds.extend(matchLocation);
      map.fitBounds(bounds, 64);
    },
    [userLocation, matchLocation]
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fitBoth(map);
    },
    [fitBoth]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (map) fitBoth(map);
  }, [fitBoth]);

  const fallbackCenter = useMemo(
    () => ({
      lat: (userLocation.lat + matchLocation.lat) / 2,
      lng: (userLocation.lng + matchLocation.lng) / 2,
    }),
    [userLocation, matchLocation]
  );

  if (!apiKey.trim()) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 text-center text-sm text-amber-900">
        Add <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
        to your env to load the map.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-center text-sm text-red-800">
        Could not load Google Maps. Check the API key and billing.
      </div>
    );
  }

  if (authFailed) {
    return (
      <div className="flex h-[320px] flex-col justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 text-sm text-amber-950">
        <p className="font-semibold">Google Maps blocked this page (API key / Cloud setup).</p>
        <ul className="list-disc space-y-1 pl-5 text-amber-900/90">
          <li>
            Enable the <strong>Maps JavaScript API</strong> for the key&apos;s Google Cloud project.
          </li>
          <li>
            Ensure <strong>billing</strong> is enabled on that project.
          </li>
          <li>
            If the key uses <strong>HTTP referrer</strong> restrictions, add one entry per dev
            origin (same host and port as your browser URL), e.g.{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              http://localhost:3000/*
            </code>
            ,{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              http://localhost:3001/*
            </code>
            ,{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              http://localhost:3002/*
            </code>
            , and matching{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              http://127.0.0.1:PORT/*
            </code>{" "}
            lines if you open the app via 127.0.0.1.
          </li>
        </ul>
        <p className="text-xs text-amber-800/80">
          After changing the key or restrictions, wait a minute and hard-refresh the page.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
        Loading map…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={fallbackCenter}
        zoom={13}
        onLoad={onMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        <Marker position={userLocation} label="A" title="You" />
        <Marker
          position={matchLocation}
          label="B"
          title={matchTitle ?? "Matched resource"}
        />
      </GoogleMap>
    </div>
  );
}
