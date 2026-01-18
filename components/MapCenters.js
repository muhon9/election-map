"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import CenterAreasPanel from "@/components/CenterAreasPanel";

// ------------ Helpers ------------

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const SATELLITE_HIDE_LABELS = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  // { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
  // { featureType: "landscape.man_made", stylers: [{ visibility: "off" }] },
  // { elementType: "labels", stylers: [{ visibility: "off" }] },
];

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

// Get lat/lng for area (from .lat/.lng or GeoJSON Point)
function getAreaLatLng(area) {
  if (!area) return null;
  if (typeof area.lat === "number" && typeof area.lng === "number") {
    return { lat: area.lat, lng: area.lng };
  }
  const coords = area.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return { lat: coords[1], lng: coords[0] };
  }
  return null;
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
  const selectedCenterId = sp.get("sel") || "";

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

  // Areas for selected center
  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areasErr, setAreasErr] = useState("");

  // Toggles
  const [showCenters, setShowCenters] = useState(true);
  const [showAreas, setShowAreas] = useState(true);

  // Selected area (local)
  const [selectedAreaId, setSelectedAreaId] = useState("");

  // Map ref (to pan/fitBounds)
  const mapRef = useRef(null);

  // Map type: normal vs satellite
  const [mapType, setMapType] = useState("roadmap"); // "roadmap" | "hybrid"

  // Google Maps loader
  const { isLoaded } = useJsApiLoader({
    id: "map-page-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Marker CSS
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

  // ---- Load top-level geo ----
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

  // City -> wards
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

  // Upazila -> unions
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

  // Union -> rural wards
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
    setSelectedAreaId("");
    setAreas([]);
    setAreasErr("");
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
      setSelectedAreaId("");
      setAreas([]);
      setAreasErr("");

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

        if (params.length === 0) {
          if (!alive) return;
          setCenters([]);
          setLoadingCenters(false);
          return;
        }

        const qs = `?${params.join("&")}&limit=500&sort=totalVoters&dir=desc`;
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

  // ---- Selected center / area ----
  const selectedCenter = useMemo(
    () =>
      centers.find((c) => String(c._id) === String(selectedCenterId)) || null,
    [centers, selectedCenterId],
  );

  const selectedArea = useMemo(
    () => areas.find((a) => String(a._id) === String(selectedAreaId)) || null,
    [areas, selectedAreaId],
  );

  // ---- Load areas for selected center (when showAreas is ON) ----
  useEffect(() => {
    if (!selectedCenter || !showAreas) {
      setAreas([]);
      setAreasErr("");
      setLoadingAreas(false);
      setSelectedAreaId("");
      return;
    }

    let alive = true;
    (async () => {
      try {
        setLoadingAreas(true);
        setAreasErr("");
        setAreas([]);
        setSelectedAreaId("");

        const qs = `?centerId=${encodeURIComponent(
          selectedCenter._id,
        )}&limit=500`;
        const j = await fetchJSON(`/api/areas${qs}`);
        if (!alive) return;
        const items = Array.isArray(j) ? j : j.items || [];
        setAreas(items);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setAreas([]);
        setAreasErr(e.message || "Failed to load areas");
      } finally {
        if (alive) setLoadingAreas(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedCenter?._id, showAreas]);

  // Map initial center
  const initialCenter = useMemo(() => {
    if (!centers.length) return { lat: 24.8949, lng: 91.8687 }; // Sylhet fallback
    const lat =
      centers.reduce((a, c) => a + (c.lat || 0), 0) / (centers.length || 1);
    const lng =
      centers.reduce((a, c) => a + (c.lng || 0), 0) / (centers.length || 1);
    return { lat, lng };
  }, [centers]);

  // ---- Zoom to center + areas when selection / areas change ----
  useEffect(() => {
    if (!mapRef.current || !selectedCenter) return;
    if (
      typeof selectedCenter.lat !== "number" ||
      typeof selectedCenter.lng !== "number"
    ) {
      return;
    }

    const hasAreaPositions =
      showAreas &&
      areas.some((a) => {
        const pos = getAreaLatLng(a);
        return !!pos;
      });

    // If we have area points, fit bounds around center + areas
    if (hasAreaPositions) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: selectedCenter.lat, lng: selectedCenter.lng });
      areas.forEach((a) => {
        const pos = getAreaLatLng(a);
        if (!pos) return;
        bounds.extend(pos);
      });
      mapRef.current.fitBounds(bounds);
    } else {
      // Otherwise just zoom to center
      mapRef.current.panTo({
        lat: selectedCenter.lat,
        lng: selectedCenter.lng,
      });
      mapRef.current.setZoom(15);
    }
  }, [selectedCenter?._id, areas, showAreas]);

  // Handlers
  function onCenterMarkerClick(id) {
    setSelectedAreaId("");
    updateQuery({ sel: id });
  }

  function onAreaMarkerClick(id) {
    setSelectedAreaId(id);
  }

  function clearSelection() {
    setSelectedAreaId("");
    setAreas([]); // ensure red lines disappear
    setAreasErr("");
    updateQuery({ sel: null });
  }

  function onMapLoad(map) {
    mapRef.current = map;
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

  // Lines (center -> areas)
  // const areaLines = useMemo(() => {
  //   if (!selectedCenter || !showAreas || !areas.length) return [];
  //   if (
  //     typeof selectedCenter.lat !== "number" ||
  //     typeof selectedCenter.lng !== "number"
  //   ) {
  //     return [];
  //   }
  //   const centerPos = { lat: selectedCenter.lat, lng: selectedCenter.lng };
  //   const lines = [];
  //   areas.forEach((a) => {
  //     const pos = getAreaLatLng(a);
  //     if (!pos) return;
  //     lines.push({
  //       id: String(a._id),
  //       path: [centerPos, pos],
  //     });
  //   });
  //   return lines;
  // }, [selectedCenter, areas, showAreas]);

  const areaLines = useMemo(() => {
    if (!selectedCenter || !showAreas || !areas.length) return [];
    if (
      typeof selectedCenter.lat !== "number" ||
      typeof selectedCenter.lng !== "number"
    ) {
      return [];
    }
    const centerPos = { lat: selectedCenter.lat, lng: selectedCenter.lng };
    const lines = [];
    areas.forEach((a) => {
      const pos = getAreaLatLng(a);
      if (!pos) return;
      lines.push({
        id: String(a._id),
        path: [centerPos, pos],
      });
    });
    return lines;
  }, [selectedCenter, areas, showAreas]);

  // Sidebar detail: center vs area
  const detailMode = selectedArea ? "area" : selectedCenter ? "center" : "none";

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
                <option value="">-No Selection-</option>
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

          {/* Toggles */}
          <div className="flex items-center gap-3 text-xs">
            {/* Map type toggle */}
            <div className="inline-flex rounded border overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 ${
                  mapType === "roadmap"
                    ? "bg-blue-600 text-white text-[11px]"
                    : "bg-white text-[11px] hover:bg-gray-50"
                }`}
                onClick={() => setMapType("roadmap")}
              >
                Map
              </button>
              <button
                type="button"
                className={`px-2 py-1 ${
                  mapType === "hybrid"
                    ? "bg-blue-600 text-white text-[11px]"
                    : "bg-white text-[11px] hover:bg-gray-50"
                }`}
                onClick={() => setMapType("hybrid")}
              >
                Satellite
              </button>
            </div>

            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={showCenters}
                onChange={(e) => setShowCenters(e.target.checked)}
              />
              <span>Show centers</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={showAreas}
                onChange={(e) => setShowAreas(e.target.checked)}
                disabled={!selectedCenter}
              />
              <span>Show areas</span>
            </label>
          </div>

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
        {selectedCenter && showAreas && (
          <div className="mt-1 text-[11px] text-gray-500">
            {loadingAreas
              ? "Loading areas for this center…"
              : areasErr
                ? areasErr
                : areas.length
                  ? `${areas.length} areas for this center`
                  : "No areas with location for this center."}
          </div>
        )}
      </div>

      {/* Map + side panel (map fixed, sidebar scroll) */}
      <div className="grid w-screen md:w-auto gap-2 md:flex-1 md:grid-rows-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.3fr)]">
        {/* Map (fixed) */}
        <div className="rounded border overflow-hidden min-h-0">
          {!isLoaded ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              Loading map…
            </div>
          ) : !centers.length ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              Select City / Upazila filters to view centers on map.
            </div>
          ) : (
            <div className="rounded border overflow-hidden w-screen md:w-auto h-[55vh] md:h-[70vh]">
              {/* GoogleMap ... */}
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={initialCenter}
                zoom={12}
                onLoad={onMapLoad}
                onClick={clearSelection}
                options={{
                  mapTypeId: mapType === "hybrid" ? "hybrid" : "roadmap",
                  styles:
                    mapType === "hybrid"
                      ? SATELLITE_HIDE_LABELS
                      : MINIMAL_MAP_STYLE,
                  disableDefaultUI: true,
                  zoomControl: true,
                  gestureHandling: "greedy",
                  backgroundColor: "#f7f7f7",
                }}

                //   options={{
                //   mapTypeId: mapType === "hybrid" ? "hybrid" : "roadmap",
                //   styles: mapType === "hybrid" ? SATELLITE_HIDE_LABELS : MINIMAL_MAP_STYLE,
                //   disableDefaultUI: true,
                //   zoomControl: true,
                //   gestureHandling: "greedy",
                // }}
              >
                {/* Center markers */}
                {showCenters &&
                  centers.map((c) => {
                    const id = String(c._id);
                    const isSelected = id === String(selectedCenterId);
                    const short = c?.name
                      ? c.name.length > 12
                        ? c.name.slice(0, 12) + "…"
                        : c.name
                      : "Center";

                    if (
                      typeof c.lat !== "number" ||
                      typeof c.lng !== "number"
                    ) {
                      return null;
                    }

                    return (
                      <Marker
                        key={id}
                        position={{ lat: c.lat, lng: c.lng }}
                        onClick={() => onCenterMarkerClick(id)}
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

                {/* Area markers */}
                {showAreas &&
                  selectedCenter &&
                  areas.map((a) => {
                    const pos = getAreaLatLng(a);
                    if (!pos) return null;
                    const id = String(a._id);
                    const isSel = id === String(selectedAreaId);

                    const totalVoters = Number(a.totalVoters || 0);

                    // const size =
                    //   40 + Math.min(32, Math.floor((totalVoters || 0) / 500));
                    // voters varies from ~0 to ~5000, so size 40-50 so make it more visible
                    const size =
                      32 + Math.min(32, Math.floor((totalVoters || 0) / 50)); // 40-80
                    const short = a?.name
                      ? a.name.length > 14
                        ? a.name.slice(0, 14) + "…"
                        : a.name
                      : "Area";

                    return (
                      <Marker
                        key={id}
                        position={pos}
                        onClick={() => onAreaMarkerClick(id)}
                        icon={{
                          url: pinDataUrl(isSel ? "#b91c1c" : "#dc2626"),
                          scaledSize: new google.maps.Size(size, size),
                          anchor: new google.maps.Point(size / 2, size),
                          labelOrigin: new google.maps.Point(size / 2, -4),
                        }}
                        label={{
                          text: short,
                          className: `marker-badge ${
                            isSel ? "marker-badge--selected" : ""
                          }`,
                        }}
                        zIndex={isSel ? 1200 : 1100}
                      />
                    );
                  })}

                {/* Lines center -> area */}
                {areaLines.map((line) => (
                  <Polyline
                    key={line.id}
                    path={line.path}
                    options={{
                      strokeColor: "#f97316",
                      strokeOpacity: 0.7,
                      strokeWeight: 2,
                    }}
                  />
                ))}
              </GoogleMap>
            </div>
          )}
        </div>

        {/* Sidebar (scroll-only) */}
        <div className="rounded border bg-white p-3 text-sm overflow-scroll md:overflow-y-auto md:min-h-0">
          {detailMode === "none" && (
            <div className="text-gray-600">
              {centers.length
                ? "Click a marker or select a center from the list to see details."
                : "No centers selected."}
            </div>
          )}

          {detailMode === "center" && selectedCenter && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">
                    Center
                  </div>
                  <div className="font-semibold text-gray-800">
                    {selectedCenter.name}
                  </div>
                </div>
                <a
                  href={`/centers/${selectedCenter._id}`}
                  className="text-blue-600 underline"
                >
                  Open
                </a>
              </div>

              {selectedCenter.address && (
                <div>
                  <span className="text-gray-500">Address:</span>{" "}
                  {selectedCenter.address}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-gray-500">Total voters:</span>{" "}
                  <span className="font-semibold text-green-700">
                    {selectedCenter.totalVoters ?? 0}
                  </span>
                </div>
                <div>Male: {selectedCenter.maleVoters ?? 0}</div>
                <div>Female: {selectedCenter.femaleVoters ?? 0}</div>
              </div>

              {selectedCenter.notes && (
                <div>
                  <span className="text-gray-500">Notes:</span>{" "}
                  {selectedCenter.notes}
                </div>
              )}
            </div>
          )}

          {detailMode === "area" && selectedArea && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">
                    Area
                  </div>
                  <div className="font-semibold text-gray-800">
                    {selectedArea.name}
                  </div>
                </div>
                <a
                  href={`/areas/${selectedArea._id}`}
                  className="text-blue-600 underline"
                >
                  Open
                </a>
              </div>

              {selectedCenter && (
                <div className="text-xs text-gray-600">
                  Center:{" "}
                  <button
                    className="text-blue-600 underline"
                    onClick={() => {
                      setSelectedAreaId("");
                      if (selectedCenter._id) {
                        updateQuery({ sel: selectedCenter._id });
                      }
                    }}
                  >
                    {selectedCenter.name}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-gray-500">Total voters:</span>{" "}
                  <span className="font-semibold text-green-700">
                    {selectedArea.totalVoters ?? 0}
                  </span>
                </div>
                <div>Male: {selectedArea.maleVoters ?? 0}</div>
                <div>Female: {selectedArea.femaleVoters ?? 0}</div>
              </div>

              {selectedArea.notes && (
                <div>
                  <span className="text-gray-500">Notes:</span>{" "}
                  {selectedArea.notes}
                </div>
              )}
            </div>
          )}

          {/* Centers list */}
          {centers.length > 0 && (
            <div className="mb-4 border-t pt-3">
              <h3 className="font-semibold mb-2">Centers in this filter</h3>
              <div className="space-y-1">
                {centers.map((c) => {
                  const id = String(c._id);
                  const isSel = id === String(selectedCenterId);
                  return (
                    <button
                      key={id}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between ${
                        isSel ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedAreaId("");
                        updateQuery({ sel: id });
                        if (
                          typeof c.lat === "number" &&
                          typeof c.lng === "number" &&
                          mapRef.current
                        ) {
                          mapRef.current.panTo({ lat: c.lat, lng: c.lng });
                          mapRef.current.setZoom(15);
                        }
                      }}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-2 text-[10px] text-gray-500 whitespace-nowrap">
                        {c.totalVoters ?? 0} voters
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Areas & People for selected center */}
          {selectedCenter && (
            <div className="pt-2 border-t mt-2">
              <h3 className="font-semibold mb-1">Areas</h3>
              <CenterAreasPanel center={selectedCenter} />
            </div>
          )}

          {(selectedCenter || selectedArea) && (
            <button
              className="mt-3 text-xs text-gray-600 hover:underline"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
