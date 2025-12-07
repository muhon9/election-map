"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import CenterAreasPanel from "@/components/CenterAreasPanel";

// ------------ Helpers ------------

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const MINIMAL_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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

// ------------ Page ------------

export default function MapPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // URL-driven state
  const mode = sp.get("mode") === "rural" ? "rural" : "city"; // default city

  const cityId = sp.get("cityId") || "";
  const cityWardId = sp.get("cityWardId") || "";
  const upazilaId = sp.get("upazilaId") || "";
  const unionId = sp.get("unionId") || "";
  const ruralWardId = sp.get("ruralWardId") || "";
  const selectedId = sp.get("sel") || "";

  // Data state
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  const [centers, setCenters] = useState([]);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [err, setErr] = useState("");

  // Google Maps loader
  const { isLoaded } = useJsApiLoader({
    id: "map-page-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Global marker label styles (same as MapCenters)
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
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
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Helper: update query params in URL (filters + selection)
  function updateQuery(patch, { replace = false } = {}) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || typeof value === "undefined") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (replace) router.replace(url);
    else router.push(url);
  }

  // ---- Load top-level geo (city corps, upazilas) ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingGeo(true);
        const [cc, upa] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        if (!alive) return;
        setCityCorps(cc.items || []);
        setUpazilas(upa.items || []);
      } catch (e) {
        if (!alive) return;
        console.error("Failed loading geo top-level", e);
      } finally {
        if (alive) setLoadingGeo(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // City changed -> load wards
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
        if (!alive) return;
        setCityWards(j.items || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityId]);

  // Upazila changed -> load unions
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`);
        if (!alive) return;
        setUnions(j.items || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [upazilaId]);

  // Union changed -> load rural wards
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${unionId}&active=1`);
        if (!alive) return;
        setRuralWards(j.items || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unionId]);

  // ---- Mode toggle ----
  function chooseMode(next) {
    if (next === "city") {
      updateQuery({
        mode: "city",
        upazilaId: null,
        unionId: null,
        ruralWardId: null,
        sel: null,
      });
    } else {
      updateQuery({
        mode: "rural",
        cityId: null,
        cityWardId: null,
        sel: null,
      });
    }
  }

  // ---- Load centers when filters change ----
  useEffect(() => {
    let alive = true;

    async function loadCenters() {
      setLoadingCenters(true);
      setErr("");
      setCenters([]);

      try {
        const params = [];

        if (mode === "city") {
          if (cityId) params.push(`cityId=${encodeURIComponent(cityId)}`);
          if (cityWardId)
            params.push(`wardId=${encodeURIComponent(cityWardId)}`);
        } else {
          if (upazilaId)
            params.push(`upazilaId=${encodeURIComponent(upazilaId)}`);
          if (unionId) params.push(`unionId=${encodeURIComponent(unionId)}`);
          if (ruralWardId)
            params.push(`wardId=${encodeURIComponent(ruralWardId)}`);
        }

        // If no filters -> do not load anything
        if (params.length === 0) {
          if (!alive) return;
          setCenters([]);
          setLoadingCenters(false);
          return;
        }

        const qs = `?${params.join("&")}&limit=500`;
        const j = await fetchJSON(`/api/centers${qs}`);
        if (!alive) return;

        const items = Array.isArray(j) ? j : j.items || [];
        setCenters(items);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr(e.message || "Failed to load centers");
        setCenters([]);
      } finally {
        if (alive) setLoadingCenters(false);
      }
    }

    loadCenters();
    return () => {
      alive = false;
    };
  }, [mode, cityId, cityWardId, upazilaId, unionId, ruralWardId]);

  // Map center
  const initialCenter = useMemo(() => {
    if (!centers.length) return { lat: 24.8949, lng: 91.8687 }; // Sylhet fallback
    const lat =
      centers.reduce((a, c) => a + (c.lat || 0), 0) / (centers.length || 1);
    const lng =
      centers.reduce((a, c) => a + (c.lng || 0), 0) / (centers.length || 1);
    return { lat, lng };
  }, [centers]);

  const selected = useMemo(
    () => centers.find((c) => String(c._id) === String(selectedId)) || null,
    [centers, selectedId]
  );

  function onMarkerClick(id) {
    updateQuery({ sel: id });
  }

  function clearSelection() {
    updateQuery({ sel: null });
  }

  function onMapLoad(map) {
    if (!centers.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    centers.forEach((c) => {
      if (typeof c.lat === "number" && typeof c.lng === "number") {
        bounds.extend({ lat: c.lat, lng: c.lng });
      }
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] space-y-2">
      {/* Top filter bar */}
      <div className="border-b bg-white/90 backdrop-blur px-3 py-2 z-10">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode tabs */}
          <div className="inline-flex rounded border overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${
                mode === "city"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("city")}
            >
              City
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${
                mode === "rural"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("rural")}
            >
              Upazila
            </button>
          </div>

          {/* City filters */}
          {mode === "city" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={cityId}
                onChange={(e) =>
                  updateQuery({
                    mode: "city",
                    cityId: e.target.value || null,
                    cityWardId: null,
                    upazilaId: null,
                    unionId: null,
                    ruralWardId: null,
                    sel: null,
                  })
                }
              >
                <option value="">City Corporation…</option>
                {cityCorps.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={cityWardId}
                onChange={(e) =>
                  updateQuery({
                    mode: "city",
                    cityWardId: e.target.value || null,
                    sel: null,
                  })
                }
                disabled={!cityId}
              >
                <option value="">Ward…</option>
                {cityWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            // Rural filters
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={upazilaId}
                onChange={(e) =>
                  updateQuery({
                    mode: "rural",
                    upazilaId: e.target.value || null,
                    unionId: null,
                    ruralWardId: null,
                    cityId: null,
                    cityWardId: null,
                    sel: null,
                  })
                }
              >
                <option value="">Upazila…</option>
                {upazilas.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={unionId}
                onChange={(e) =>
                  updateQuery({
                    mode: "rural",
                    unionId: e.target.value || null,
                    ruralWardId: null,
                    sel: null,
                  })
                }
                disabled={!upazilaId}
              >
                <option value="">Union…</option>
                {unions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={ruralWardId}
                onChange={(e) =>
                  updateQuery({
                    mode: "rural",
                    ruralWardId: e.target.value || null,
                    sel: null,
                  })
                }
                disabled={!unionId}
              >
                <option value="">Ward…</option>
                {ruralWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto text-xs text-gray-600">
            {loadingGeo
              ? "Loading locations…"
              : loadingCenters
              ? "Loading centers…"
              : centers.length
              ? `${centers.length} centers`
              : "Select filter to see centers"}
          </div>
        </div>

        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      </div>

      {/* Map + side panel */}
      <div className="flex-1 grid grid-rows-[minmax(0,1fr)_auto] md:grid-rows-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.3fr)] gap-2">
        {/* Map */}
        <div className="rounded border overflow-hidden">
          {!isLoaded ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              Loading map…
            </div>
          ) : !centers.length ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              Select City / Upazila filters to view centers on map.
            </div>
          ) : (
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
              {centers.map((c) => {
                const id = String(c._id);
                const isSelected = id === String(selectedId);
                const short = c?.name
                  ? c.name.length > 12
                    ? c.name.slice(0, 12) + "…"
                    : c.name
                  : "Center";

                if (typeof c.lat !== "number" || typeof c.lng !== "number") {
                  return null;
                }

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

        {/* Side info (center details + areas) */}
        <div className="rounded border bg-white p-3 text-sm overflow-y-auto">
          {!selected ? (
            <div className="text-gray-600">
              {centers.length
                ? "Click a marker to see center details and areas here."
                : "No centers selected."}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Basic center info */}
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-gray-800">
                  {selected.name}
                </div>
                <a
                  href={`/centers/${selected._id}`}
                  className="text-blue-600 underline"
                >
                  Open
                </a>
              </div>

              {selected.address && (
                <div>
                  <span className="text-gray-500">Address:</span>{" "}
                  {selected.address}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-gray-500">Total voters:</span>{" "}
                  <span className="font-semibold text-green-700">
                    {selected.totalVoters ?? 0}
                  </span>
                </div>
                <div>Male: {selected.maleVoters ?? 0}</div>
                <div>Female: {selected.femaleVoters ?? 0}</div>
              </div>

              {selected.notes && (
                <div>
                  <span className="text-gray-500">Notes:</span> {selected.notes}
                </div>
              )}

              {/* Areas & voters for this center */}
              <div className="pt-2 border-t mt-2">
                <h3 className="font-semibold mb-1">Areas & People</h3>
                <CenterAreasPanel center={selected} />
              </div>

              <button
                className="mt-2 text-gray-600 hover:underline"
                onClick={clearSelection}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
