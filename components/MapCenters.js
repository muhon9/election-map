"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import CenterAreasPanel from "./CenterAreasPanel";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const containerStyle = { width: "100%", height: "420px" };

// Minimal style: hide *all* labels and most clutter
const MINIMAL_MAP_STYLE = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "landscape.man_made", stylers: [{ visibility: "off" }] },
];

// Simple SVG pin as data URL; colorizable
function pinDataUrl(color = "#2563eb") {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
        <path fill="${color}" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg>
    `)
  );
}

export default function MapCenters() {
  const [centers, setCenters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // URL utils
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // RBAC
  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");

  // Google Maps loader
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Load centers for map mode (returns full docs)
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/centers?mode=map`, { cache: "no-store" });
      const data = await res.json();
      if (!alive) return;
      setCenters(Array.isArray(data) ? data : []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Sync selected center from URL (?sel=ID) whenever centers or URL changes
  useEffect(() => {
    const selFromUrl = sp.get("sel");
    if (!selFromUrl) {
      setSelectedId(null);
      return;
    }
    // Only set if that ID exists among loaded centers
    if (centers.some((c) => String(c._id) === selFromUrl)) {
      setSelectedId(selFromUrl);
    } else {
      // If not found (e.g., list not loaded yet), leave as-is; another effect run will set it.
      // Optionally: setSelectedId(null);
    }
  }, [sp, centers]);

  // Keep a memoized selected center
  const selected = useMemo(
    () => centers.find((c) => String(c._id) === String(selectedId)) || null,
    [centers, selectedId]
  );

  // Initial center positioning
  const initialCenter = useMemo(() => {
    if (!centers.length) return { lat: 23.7806, lng: 90.407 }; // Dhaka fallback
    const lat = centers.reduce((a, c) => a + (c.lat || 0), 0) / centers.length;
    const lng = centers.reduce((a, c) => a + (c.lng || 0), 0) / centers.length;
    return { lat, lng };
  }, [centers]);

  // Fit bounds once map loads and data present
  const onMapLoad = (map) => {
    if (centers.length) {
      const bounds = new window.google.maps.LatLngBounds();
      centers.forEach((c) => {
        if (typeof c.lat === "number" && typeof c.lng === "number") {
          bounds.extend({ lat: c.lat, lng: c.lng });
        }
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    }
  };

  // Helper: write sel into URL without full nav
  function setSelInUrl(idOrNull) {
    const params = new URLSearchParams(sp.toString());
    if (idOrNull) params.set("sel", String(idOrNull));
    else params.delete("sel");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Clicking a marker -> select + update URL
  function onMarkerClick(id) {
    setSelectedId(id);
    setSelInUrl(id);
  }

  // Clicking blank map clears selection + URL
  function clearSelection() {
    setSelectedId(null);
    setSelInUrl(null);
  }

  return (
    <div className="space-y-3">
      {/* Marker label (white card) styles */}
      <style jsx global>{`
        .marker-badge {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 11px;
          line-height: 1.2;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
          transform: translateY(-6px);
          pointer-events: none; /* keep clicks on marker, not label */
          color: #111827; /* gray-900 */
          font-weight: 600;
        }
        .marker-badge--selected {
          border-color: rgba(16, 185, 129, 0.25); /* green-500-ish */
          box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
        }
      `}</style>

      <div className="rounded border overflow-hidden">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={initialCenter}
            zoom={12}
            onLoad={onMapLoad}
            onClick={clearSelection}
            options={{
              styles: MINIMAL_MAP_STYLE,
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: "greedy",
              backgroundColor: "#f7f7f7",
            }}
          >
            {centers.map((c) => {
              const id = String(c._id);
              const isSelected = id === String(selectedId);
              const short = c?.name
                ? c.name.length > 12
                  ? c.name.slice(0, 12) + "…"
                  : c.name
                : "Center";
              return (
                <Marker
                  key={id}
                  position={{ lat: c.lat, lng: c.lng }}
                  onClick={() => onMarkerClick(id)}
                  icon={{
                    url: isSelected
                      ? pinDataUrl("#16a34a")
                      : pinDataUrl("#2563eb"),
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 32),
                    labelOrigin: new google.maps.Point(16, -2),
                  }}
                  label={{
                    text: short,
                    className: `marker-badge ${
                      isSelected ? "marker-badge--selected" : ""
                    }`,
                  }}
                  zIndex={isSelected ? 999 : 1}
                />
              );
            })}
          </GoogleMap>
        )}
      </div>

      {/* Details panel under the map */}
      <div className="rounded border bg-white p-4">
        {!selected ? (
          <div className="text-sm text-gray-600">
            {centers.length} centers found. Tap a marker to see center details.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-y-1 gap-x-6 text-sm">
            {/* Center Name */}
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-800">
                {selected.name}
              </div>
              <div className="flex items-center gap-3">
                {/* Details page */}
                <a
                  className="text-gray-700 underline"
                  href={`/centers/${selected._id}`}
                >
                  See details
                </a>
                {/* Edit (RBAC) */}
                {canEdit && (
                  <a
                    className="inline-flex items-center px-3 py-1.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                    href={`/centers/${selected._id}/edit`}
                  >
                    Edit
                  </a>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <span className="text-gray-500">Address:</span>{" "}
              {selected.address || "—"}
            </div>

            {/* Voters summary */}
            <div className="md:col-span-2 mt-2">
              <span className="text-gray-500">Total voters:</span>{" "}
              <span className="text-md font-bold text-green-700">
                {selected.totalVoters ?? 0}
              </span>
              <div className="ml-4 mt-1 text-sm text-gray-700">
                <div>Male voters: {selected.maleVoters ?? 0}</div>
                <div>Female voters: {selected.femaleVoters ?? 0}</div>
              </div>
            </div>

            {/* Notes (optional) */}
            {selected.notes && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Notes:</span> {selected.notes}
              </div>
            )}

            {/* Areas & People (lazy; handled inside this component) */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-base font-semibold mb-2">Areas & People</h3>
              {/* Pass the selected center to your panel that fetches areas and shows People (committee/renowned/contacts) */}
              <CenterAreasPanel center={selected} />
            </div>

            {/* Footer links */}
            <div className="md:col-span-2 mt-2">
              <a className="text-gray-600 underline mr-3" href={`/centers`}>
                All centers
              </a>
              <button
                className="text-gray-600 hover:underline"
                onClick={clearSelection}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
