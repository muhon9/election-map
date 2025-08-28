"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import CenterAreasPanel from "./CenterAreasPanel";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const containerStyle = { width: "100%", height: "420px" };

// Minimal style (hide all labels/POIs/etc)
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

  // URL utils for preserving selected marker
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selFromUrl = sp.get("sel");

  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Fetch centers (full docs in map mode)
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/centers?mode=map`, { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!alive) return;
      setCenters(Array.isArray(data) ? data : []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // When centers are loaded, honor ?sel from the URL
  useEffect(() => {
    if (!centers.length || !selFromUrl) return;
    const exists = centers.some((c) => String(c._id) === String(selFromUrl));
    if (exists) setSelectedId(selFromUrl);
  }, [centers, selFromUrl]);

  const selected = useMemo(
    () => centers.find((c) => String(c._id) === String(selectedId)) || null,
    [centers, selectedId]
  );

  const initialCenter = useMemo(() => {
    if (!centers.length) return { lat: 23.7806, lng: 90.407 }; // Dhaka fallback
    const lat = centers.reduce((a, c) => a + (c.lat || 0), 0) / centers.length;
    const lng = centers.reduce((a, c) => a + (c.lng || 0), 0) / centers.length;
    return { lat, lng };
  }, [centers]);

  const onMapLoad = (map) => {
    if (centers.length) {
      const bounds = new window.google.maps.LatLngBounds();
      centers.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    }
  };

  // Write sel into URL without full navigation (shallow)
  function setSelInUrl(idOrNull) {
    const params = new URLSearchParams(sp.toString());
    if (idOrNull) params.set("sel", String(idOrNull));
    else params.delete("sel");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Clicking a marker -> select + update URL (?sel=...)
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
              const isSelected = String(c._id) === String(selectedId);
              const short = c?.name
                ? c.name.length > 12
                  ? c.name.slice(0, 12) + "…"
                  : c.name
                : "Center";

              return (
                <Marker
                  key={c._id}
                  position={{ lat: c.lat, lng: c.lng }}
                  onClick={() => onMarkerClick(c._id)}
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
            {/* Center Name bigger */}
            <div className="md:col-span-2 text-lg font-semibold text-gray-800">
              {selected.name}
            </div>

            <div>
              <span className="text-gray-500">Address:</span>{" "}
              {selected.address || "-"}
            </div>
            {/* <div>
              <span className="text-gray-500">Lat/Lng:</span> {selected.lat},{" "}
              {selected.lng}
            </div> */}

            {/* Person to communicate (clickable phone) */}
            {/* <div className="md:col-span-2">
              <span className="text-gray-500">Person to communicate:</span>{" "}
              {selected.contact?.name ? (
                selected.contact?.phone ? (
                  <a
                    href={`tel:${selected.contact.phone}`}
                    className="text-blue-600 underline"
                  >
                    {selected.contact.name} ({selected.contact.phone})
                  </a>
                ) : (
                  selected.contact.name
                )
              ) : (
                "—"
              )}
            </div> */}

            {/* Highlight Total Voters */}

            <div className="md:col-span-2 mt-4">
              <h3 className="text-base font-semibold mb-2">Areas & People</h3>
              <CenterAreasPanel center={selected} />
            </div>
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

            {selected.notes && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Notes:</span> {selected.notes}
              </div>
            )}

            <div className="md:col-span-2 mt-2 flex flex-wrap items-center gap-3">
              <a
                className="text-gray-700 border px-3 py-1.5 rounded hover:bg-gray-50"
                href={`/centers`}
              >
                All centers
              </a>
              <a
                className="text-gray-700 underline"
                href={`/centers/${selected._id}`}
              >
                See details of this center
              </a>
              {canEdit && (
                <a
                  className="text-white bg-blue-600 px-3 py-1.5 rounded hover:bg-blue-700"
                  href={`/centers/${selected._id}/edit`}
                >
                  Edit
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Marker label styling */}
      <style jsx global>{`
        .marker-badge {
          background: white;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          font-weight: 600;
          font-size: 11px;
          color: #111827;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
          pointer-events: none; /* so click goes to marker */
        }
        .marker-badge--selected {
          background: #ecfdf5; /* green-50 */
          border-color: #22c55e33;
        }
      `}</style>
    </div>
  );
}
