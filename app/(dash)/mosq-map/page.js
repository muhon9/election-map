// app/(dash)/mosq-map/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Minimal style: hide labels and clutter
const MINIMAL_MAP_STYLE = [
  // { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  // {
  //   featureType: "road",
  //   elementType: "labels.icon",
  //   stylers: [{ visibility: "off" }],
  // },
  // { featureType: "landscape.man_made", stylers: [{ visibility: "off" }] },
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

// Validate & normalize one mosq item to a map point
function toPoint(m) {
  const lat = Number(m?.location?.lat);
  const lng = Number(m?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 || lng === 0) return null; // ✨ skip zero coords
  return {
    _id: String(m?._id || m?.id || Math.random()),
    name: m?.name || "Mosq",
    lat,
    lng,
    address: m?.address || "",
    centerName: m?.center?.name || "",
    cityName: m?.cityId?.name || "",
    upazilaName: m?.upazila?.name || "",
    unionName: m?.union?.name || "",
    wardName: m?.wardId?.name || "",
    areaName: m?.area?.name || "",
    contact: m?.contact || m?.phone || "",
    raw: m,
  };
}

export default function MosqMapPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [points, setPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // URL sync (optional but nice): ?sel=<id>
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Loader
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // Fetch mosqs → normalize → filter invalid
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/mosqs?limit=1000`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load mosqs");
        const items = Array.isArray(j?.items) ? j.items : [];
        const pts = items.map(toPoint).filter(Boolean);
        if (alive) setPoints(pts);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Read selected from URL when points change
  useEffect(() => {
    const selFromUrl = sp.get("sel");
    if (!selFromUrl) {
      setSelectedId(null);
      return;
    }
    if (points.some((p) => p._id === selFromUrl)) {
      setSelectedId(selFromUrl);
    } else {
      setSelectedId(null);
    }
  }, [sp, points]);

  const selected = useMemo(
    () => points.find((p) => p._id === selectedId) || null,
    [points, selectedId]
  );

  // Initial center (fallback Dhaka) but we also fitBounds onLoad
  const initialCenter = useMemo(() => {
    if (!points.length) return { lat: 23.7806, lng: 90.407 };
    const lat = points.reduce((a, c) => a + c.lat, 0) / points.length;
    const lng = points.reduce((a, c) => a + c.lng, 0) / points.length;
    return { lat, lng };
  }, [points]);

  const onMapLoad = (map) => {
    if (!points.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    if (!bounds.isEmpty()) map.fitBounds(bounds);
  };

  // URL helper
  function setSelInUrl(idOrNull) {
    const params = new URLSearchParams(sp.toString());
    if (idOrNull) params.set("sel", String(idOrNull));
    else params.delete("sel");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onMarkerClick(id) {
    setSelectedId(id);
    setSelInUrl(id);
  }

  function clearSelection() {
    setSelectedId(null);
    setSelInUrl(null);
  }

  return (
    <div className="space-y-3 p-4">
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
          pointer-events: none;
          color: #111827;
          font-weight: 600;
        }
        .marker-badge--selected {
          border-color: rgba(16, 185, 129, 0.25);
          box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
        }
      `}</style>

      <h1 className="text-xl font-semibold">Mosq Map</h1>

      {loading && (
        <div className="border rounded bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      )}
      {!loading && err && (
        <div className="border rounded bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Map */}
          <div className="rounded border overflow-hidden h-[55vh] md:h-[420px] bg-gray-50">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
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
                {points.map((p) => {
                  const isSelected = p._id === selectedId;
                  const short =
                    p.name?.length > 14
                      ? p.name.slice(0, 14) + "…"
                      : p.name || "Mosq";
                  return (
                    <Marker
                      key={p._id}
                      position={{ lat: p.lat, lng: p.lng }}
                      onClick={() => onMarkerClick(p._id)}
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
            ) : (
              <div className="h-full grid place-items-center text-sm text-gray-500">
                Loading map…
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="rounded border bg-white">
            {/* MOBILE COLLAPSIBLE */}
            <div className="md:hidden">
              <details open={!!selected}>
                <summary className="list-none p-3 border-b cursor-pointer flex items-center justify-between">
                  <span className="font-medium">
                    {selected ? selected.name : `${points.length} mosqs`}
                  </span>
                  <span className="text-sm text-gray-500">Details</span>
                </summary>

                <div className="p-3 space-y-3">
                  {!selected ? (
                    <div className="text-sm text-gray-600">
                      Tap a marker to see details.
                    </div>
                  ) : (
                    <MobileDetails
                      selected={selected}
                      clearSelection={clearSelection}
                    />
                  )}
                </div>
              </details>
            </div>

            {/* DESKTOP OPEN CARD */}
            <div className="hidden md:block p-4">
              {!selected ? (
                <div className="text-sm text-gray-600">
                  {points.length} mosqs found. Tap a marker to see details.
                </div>
              ) : (
                <DesktopDetails
                  selected={selected}
                  clearSelection={clearSelection}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ===== Subcomponents ===== */

function DesktopDetails({ selected, clearSelection }) {
  return (
    <div className="grid md:grid-cols-2 gap-y-1 gap-x-6 text-sm">
      <div className="md:col-span-2 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-gray-800">
          {selected.name}
        </div>
        <div className="flex items-center gap-3">
          {/* If you have a mosq details page, link it here */}
          {selected.raw?._id && (
            <a
              className="text-gray-700 underline"
              href={`/mosqs/${selected.raw._id}`}
            >
              See details
            </a>
          )}
          <button
            className="text-gray-600 hover:underline"
            onClick={clearSelection}
          >
            Clear selection
          </button>
        </div>
      </div>

      <div>
        <span className="text-gray-500">Address:</span>{" "}
        {selected.address || "—"}
      </div>
      {selected.cityName && (
        <div>
          <span className="text-gray-500">City:</span>{" "}
          {selected.cityName || "—"} → {selected.wardName || "—"}
        </div>
      )}
      <div>
        <span className="text-gray-500">Center:</span>{" "}
        {selected.centerName || "—"}
      </div>

      <div>
        <span className="text-gray-500">Area:</span> {selected.areaName || "—"}
      </div>
      {selected.contact && (
        <div>
          <span className="text-gray-500">Contact:</span> {selected.contact}
        </div>
      )}

      {/* Extra raw fields example */}
      {selected.raw?.notes && (
        <div className="md:col-span-2">
          <span className="text-gray-500">Notes:</span> {selected.raw.notes}
        </div>
      )}
    </div>
  );
}

function MobileDetails({ selected, clearSelection }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{selected.name}</div>
        <button
          className="text-gray-600 hover:underline"
          onClick={clearSelection}
        >
          Clear
        </button>
      </div>

      <div>
        <span className="text-gray-500">Address:</span>{" "}
        {selected.address || "—"}
      </div>
      {selected.cityName && (
        <div>
          <span className="text-gray-500">City:</span>{" "}
          {selected.cityName || "—"} → {selected.wardName || "—"}
        </div>
      )}

      <div>
        <span className="text-gray-500">Center:</span>{" "}
        {selected.centerName || "—"}
      </div>
      <div>
        <span className="text-gray-500">Area:</span> {selected.areaName || "—"}
      </div>
      {selected.contact && (
        <div>
          <span className="text-gray-500">Contact:</span> {selected.contact}
        </div>
      )}

      {selected.raw?.notes && (
        <div>
          <span className="text-gray-500">Notes:</span> {selected.raw.notes}
        </div>
      )}
    </div>
  );
}
