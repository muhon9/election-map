"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
  usePathname,
} from "next/navigation";
import {
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api"; // ⬅️ added Polygon

/* ------------ helpers ------------ */

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

/** --- GeoJSON helpers for shape -> Google Maps paths --- */

// Safely extract a geometry object from geo.shape / geo.shapeGeometry / geo.geometry
function getGeometryFromGeo(geo) {
  if (!geo) return null;

  let raw = geo.shape || geo.shapeGeometry || geo.geometry;
  if (!raw) return null;

  let g = raw;
  if (typeof g === "string") {
    try {
      g = JSON.parse(g);
    } catch {
      return null;
    }
  }

  // Handle FeatureCollection
  if (g.type === "FeatureCollection" && Array.isArray(g.features)) {
    const firstFeature = g.features.find(
      (f) =>
        f &&
        f.geometry &&
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    );
    g = firstFeature ? firstFeature.geometry : null;
  }

  // Handle Feature
  if (g && g.type === "Feature" && g.geometry) {
    g = g.geometry;
  }

  if (!g || !g.type) return null;
  return g;
}

// Convert Polygon / MultiPolygon coordinates to Google Maps paths
function extractPolygonPaths(geometry) {
  if (!geometry) return [];

  const toLatLng = ([lng, lat]) => ({ lat, lng }); // GeoJSON is [lng, lat]

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    return rings.map((ring) => ring.map(toLatLng)); // [ [ {lat,lng} ] ]
  }

  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates || [];
    // Only use the outer ring of each polygon for now
    return polys
      .map((poly) => {
        const outer = poly[0];
        if (!outer) return null;
        return outer.map(toLatLng);
      })
      .filter(Boolean);
  }

  return [];
}

/* ------------ main page ------------ */

export default function GeoDetailPage() {
  const { id } = useParams(); // geo unit id (ward/upazila/union/city)
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // URL-driven tab + selected center
  const tabFromUrl = (sp.get("tab") || "summary").toLowerCase();
  const validTabs = ["summary", "centers"];
  const [tab, setTab] = useState(
    validTabs.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const selFromUrl = sp.get("sel") || null;
  const [selectedCenterId, setSelectedCenterId] = useState(selFromUrl);

  // Data states
  const [geo, setGeo] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoErr, setGeoErr] = useState("");

  const [centers, setCenters] = useState([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [centersErr, setCentersErr] = useState("");

  // Load Google Maps
  const { isLoaded: mapLoaded } = useJsApiLoader({
    id: "map-page-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Global marker label styles (similar to your other map)
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

  /* ------------ URL helpers ------------ */

  function updateUrl(paramsPatch) {
    const params = new URLSearchParams(sp.toString());

    Object.entries(paramsPatch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleTabChange(nextTab) {
    setTab(nextTab);
    updateUrl({ tab: nextTab });
  }

  function setSelected(idOrNull) {
    setSelectedCenterId(idOrNull);
    updateUrl({ sel: idOrNull });
  }

  /* ------------ Load GEO ------------ */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setGeoLoading(true);
        setGeoErr("");
        const j = await fetchJSON(`/api/geo/${id}`);
        if (!alive) return;
        setGeo(j);
      } catch (e) {
        if (!alive) return;
        setGeo(null);
        setGeoErr(e.message || "Failed to load geo unit");
      } finally {
        if (alive) setGeoLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  /* ------------ Load Centers for this GEO ------------ */

  useEffect(() => {
    if (!geo) return;
    let alive = true;

    (async () => {
      try {
        setCentersLoading(true);
        setCentersErr("");
        setCenters([]);

        // decide which filter to use based on geo.type
        const params = [];
        const t = (geo.type || "").toLowerCase();

        if (t === "ward") {
          params.push(`wardId=${encodeURIComponent(geo._id)}`);
        } else if (t === "union") {
          params.push(`unionId=${encodeURIComponent(geo._id)}`);
        } else if (t === "upazila") {
          params.push(`upazilaId=${encodeURIComponent(geo._id)}`);
        } else if (t === "city_corporation") {
          params.push(`cityId=${encodeURIComponent(geo._id)}`);
        }

        // We want all centers in this geo unit for map + list
        const qs = params.length
          ? `?${params.join("&")}&limit=500&sort=totalVoters&dir=desc`
          : "?limit=500";
        const j = await fetchJSON(`/api/centers${qs}`);

        if (!alive) return;
        const items = Array.isArray(j) ? j : j.items || [];
        setCenters(items);

        // if URL had sel but it's not in this list, clear it
        if (
          selFromUrl &&
          !items.some((c) => String(c._id) === String(selFromUrl))
        ) {
          setSelected(null);
        }
      } catch (e) {
        if (!alive) return;
        setCenters([]);
        setCentersErr(e.message || "Failed to load centers");
      } finally {
        if (alive) setCentersLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo?._id, geo?.type]); // depend on geo type/id only

  /* ------------ Derived data ------------ */

  const selectedCenter =
    centers.find((c) => String(c._id) === String(selectedCenterId)) || null;

  // NEW: geometry + polygon paths from geo.shape / geo.geometry
  const geometry = useMemo(() => getGeometryFromGeo(geo), [geo]);
  const polygonPaths = useMemo(() => extractPolygonPaths(geometry), [geometry]);

  const mapCenter = useMemo(() => {
    if (centers.length) {
      const lat =
        centers.reduce((acc, c) => acc + (Number(c.lat) || 0), 0) /
        centers.length;
      const lng =
        centers.reduce((acc, c) => acc + (Number(c.lng) || 0), 0) /
        centers.length;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    // Fallback: center of polygon if we have it
    const flatPoly = polygonPaths.flat();
    if (flatPoly.length) {
      const lat = flatPoly.reduce((acc, p) => acc + p.lat, 0) / flatPoly.length;
      const lng = flatPoly.reduce((acc, p) => acc + p.lng, 0) / flatPoly.length;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    // Final fallback: Sylhet
    return { lat: 24.8949, lng: 91.8687 };
  }, [centers, polygonPaths]);

  const aggregates = useMemo(() => {
    const totalCenters = centers.length;
    const totalVoters = centers.reduce(
      (acc, c) => acc + (Number(c.totalVoters) || 0),
      0
    );
    const maleVoters = centers.reduce(
      (acc, c) => acc + (Number(c.maleVoters) || 0),
      0
    );
    const femaleVoters = centers.reduce(
      (acc, c) => acc + (Number(c.femaleVoters) || 0),
      0
    );
    return { totalCenters, totalVoters, maleVoters, femaleVoters };
  }, [centers]);

  /* ------------ Map behaviors ------------ */

  function onMapLoad(map) {
    const hasCenters = centers.length > 0;
    const hasPoly = polygonPaths.length > 0;

    if (!hasCenters && !hasPoly) return;

    const bounds = new window.google.maps.LatLngBounds();

    if (hasCenters) {
      centers.forEach((c) => {
        if (typeof c.lat === "number" && typeof c.lng === "number") {
          bounds.extend({ lat: c.lat, lng: c.lng });
        }
      });
    }

    if (hasPoly) {
      polygonPaths.forEach((ring) => {
        ring.forEach((p) => bounds.extend(p));
      });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  }

  function onMarkerClick(id) {
    setSelected(id);
  }

  function clearSelection() {
    setSelected(null);
  }

  /* ------------ UI helpers ------------ */

  function geoTitle() {
    if (!geo) return "Geo Area";
    const type = (geo.type || "").toLowerCase();
    let typeLabel = "";
    if (type === "ward") typeLabel = "Ward";
    else if (type === "city_corporation") typeLabel = "City Corporation";
    else if (type === "upazila") typeLabel = "Upazila";
    else if (type === "union") typeLabel = "Union";

    return typeLabel ? `${geo.name} (${typeLabel})` : geo.name || "Geo Area";
  }

  function breadcrumb() {
    if (!geo?.chain) return null;
    const chain = geo.chain;
    const parts = [];

    if (chain.division) parts.push(chain.division.name);
    if (chain.district) parts.push(chain.district.name);
    if (chain.city_corporation && chain.city_corporation._id !== geo._id)
      parts.push(chain.city_corporation.name);
    if (chain.upazila && chain.upazila._id !== geo._id)
      parts.push(chain.upazila.name);
    if (chain.union && chain.union._id !== geo._id)
      parts.push(chain.union.name);

    if (!parts.length) return null;

    return <div className="text-xs text-gray-500">{parts.join(" › ")}</div>;
  }

  /* ------------ render ------------ */

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{geoTitle()}</h1>
            {breadcrumb()}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard title="Centers" value={aggregates.totalCenters} />
          <StatCard
            title="Total voters"
            value={aggregates.totalVoters}
            accent="text-green-700"
          />
          <StatCard title="Male voters" value={aggregates.maleVoters} />
          <StatCard title="Female voters" value={aggregates.femaleVoters} />
        </div>

        {/* Status messages */}
        {(geoLoading || centersLoading) && (
          <div className="text-xs text-gray-500">
            {geoLoading
              ? "Loading area details…"
              : "Loading centers in this area…"}
          </div>
        )}
        {(geoErr || centersErr) && (
          <div className="text-xs text-red-600">{geoErr || centersErr}</div>
        )}
      </div>

      {/* Main content: Map + Side panel */}
      <div className="grid grid-rows-[minmax(0,1fr)_auto] md:grid-rows-1 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)] gap-3 min-h-[60vh]">
        {/* Map */}
        <div className="rounded border overflow-hidden">
          {!mapLoaded ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              Loading map…
            </div>
          ) : !centers.length && !polygonPaths.length ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
              No centers or polygon found in this area.
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={mapCenter}
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
              {/* NEW: polygon shape if available */}
              {polygonPaths.length > 0 && (
                <Polygon
                  paths={polygonPaths}
                  options={{
                    strokeColor: "#ff0000", // RED BORDER
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    fillColor: "#ff0000", // same color but completely transparent
                    fillOpacity: 0.0, // TRANSPARENT INSIDE
                    clickable: false,
                    zIndex: 5,
                  }}
                />
              )}

              {/* Existing markers */}
              {centers.map((c) => {
                if (typeof c.lat !== "number" || typeof c.lng !== "number") {
                  return null;
                }
                const idStr = String(c._id);
                const isSelected = String(selectedCenterId) === idStr;
                const short = c?.name
                  ? c.name.length > 16
                    ? c.name.slice(0, 16) + "…"
                    : c.name
                  : "Center";

                return (
                  <Marker
                    key={idStr}
                    position={{ lat: c.lat, lng: c.lng }}
                    onClick={() => onMarkerClick(idStr)}
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
                    zIndex={isSelected ? 999 : 10}
                  />
                );
              })}
            </GoogleMap>
          )}
        </div>

        {/* Side panel */}
        <div className="rounded border bg-white flex flex-col">
          {/* Tabs */}
          <div className="border-b flex">
            <button
              type="button"
              className={`px-4 py-2 text-sm border-b-2 ${
                tab === "summary"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("summary")}
            >
              Summary
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm border-b-2 ${
                tab === "centers"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("centers")}
            >
              Centers
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-3 text-sm">
            {tab === "summary" && (
              <SummaryTab geo={geo} aggregates={aggregates} />
            )}
            {tab === "centers" && (
              <CentersTab
                centers={centers}
                selectedCenterId={selectedCenterId}
                onSelect={setSelected}
              />
            )}

            {/* Side selected center quick view */}
            {selectedCenter && (
              <div className="mt-4 border-t pt-3">
                <h3 className="text-sm font-semibold mb-1">Selected center</h3>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{selectedCenter.name}</div>
                  <a
                    href={`/centers/${selectedCenter._id}`}
                    className="text-xs text-blue-600 underline"
                  >
                    Open
                  </a>
                </div>
                {selectedCenter.address && (
                  <div className="mt-1 text-xs text-gray-600">
                    {selectedCenter.address}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <span>
                    Total: <b>{selectedCenter.totalVoters ?? 0}</b>
                  </span>
                  <span>M: {selectedCenter.maleVoters ?? 0}</span>
                  <span>F: {selectedCenter.femaleVoters ?? 0}</span>
                </div>
                <button
                  className="mt-2 text-xs text-gray-600 hover:underline"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------ subcomponents ------------ */

function StatCard({ title, value, accent = "" }) {
  return (
    <div className="rounded border bg-white px-3 py-2">
      <div className="text-[11px] text-gray-500">{title}</div>
      <div className={`text-base font-semibold ${accent}`}>{value ?? 0}</div>
    </div>
  );
}

function SummaryTab({ geo, aggregates }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-1">Overview</h3>
        <p className="text-xs text-gray-600">
          This summary is based on all centers inside this geo area.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Centers" value={aggregates.totalCenters} />
        <StatCard
          title="Total voters"
          value={aggregates.totalVoters}
          accent="text-green-700"
        />
        <StatCard title="Male voters" value={aggregates.maleVoters} />
        <StatCard title="Female voters" value={aggregates.femaleVoters} />
      </div>

      {geo?.notes && (
        <div>
          <h4 className="text-xs font-semibold mb-1">Notes</h4>
          <p className="text-xs text-gray-700 whitespace-pre-line">
            {geo.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function CentersTab({ centers, selectedCenterId, onSelect }) {
  if (!centers.length) {
    return (
      <div className="text-sm text-gray-600">No centers in this area yet.</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        {centers.length} center{centers.length > 1 ? "s" : ""} in this area
      </div>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-2 py-1">Center</th>
              <th className="text-left px-2 py-1">Voters</th>
              <th className="text-left px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => {
              const idStr = String(c._id);
              const isSel = String(selectedCenterId) === idStr;
              return (
                <tr
                  key={idStr}
                  className={`border-t cursor-pointer ${
                    isSel ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => onSelect(idStr)}
                >
                  <td className="px-2 py-1 align-top">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {c.address || "—"}
                    </div>
                  </td>
                  <td className="px-2 py-1 align-top whitespace-nowrap">
                    <div>Total: {c.totalVoters ?? 0}</div>
                    <div className="text-[11px] text-gray-500">
                      M: {c.maleVoters ?? 0} · F: {c.femaleVoters ?? 0}
                    </div>
                  </td>
                  <td className="px-2 py-1 align-top">
                    <a
                      href={`/centers/${c._id}`}
                      className="text-[11px] text-blue-600 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
