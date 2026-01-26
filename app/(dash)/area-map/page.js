"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

// ---------------- Helpers ----------------

async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

// coords in DB: [lng, lat]
function getAreaLatLng(area) {
  const coords = area?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function pinDataUrl(color = "#dc2626") {
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

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const SATELLITE_HIDE_LABELS = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
];

const MINIMAL_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// ---------------- Page ----------------

export default function AreasMapPage() {
  // filters
  const [mode, setMode] = useState("city"); // city | rural
  const [cityId, setCityId] = useState("");
  const [cityWardId, setCityWardId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [ruralWardId, setRuralWardId] = useState("");

  // geo dropdown data
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  // list
  const [areas, setAreas] = useState([]);
  const [allAreas, setAllAreas] = useState([]);
  const [total, setTotal] = useState(0);
  const [centersMatched, setCentersMatched] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // selected area
  const [selectedId, setSelectedId] = useState("");
  const selectedArea = useMemo(
    () => areas.find((a) => String(a._id) === String(selectedId)) || null,
    [areas, selectedId],
  );

  // ui
  const [mapType, setMapType] = useState("roadmap"); // roadmap | hybrid
  const [panelOpen, setPanelOpen] = useState(true); // mobile drawer

  // map ref
  const mapRef = useRef(null);

  // google maps loader (NO mapId needed)
  const { isLoaded } = useJsApiLoader({
    id: "map-page-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Load top level geos
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cc, upa] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        if (!alive) return;
        setCityCorps(cc.items || []);
        setUpazilas(upa.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // city -> wards
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      setCityWardId("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
        if (!alive) return;
        setCityWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityId]);

  // upazila -> unions
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      setUnionId("");
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`);
        if (!alive) return;
        setUnions(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [upazilaId]);

  // union -> rural wards
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${unionId}&active=1`);
        if (!alive) return;
        setRuralWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unionId]);

  function chooseMode(next) {
    setMode(next);
    setSelectedId("");
    setAreas([]);
    setErr("");
    if (next === "city") {
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      setCityId("");
      setCityWardId("");
    }
  }

  // Fetch all areas with location (by-admin API)
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErr("");

    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "5000"); // show all pointers
        params.set("sort", "totalVoters");
        params.set("dir", "desc");

        params.set("mode", mode);

        if (mode === "city") {
          if (cityId) params.set("cityId", cityId);
          if (cityWardId) params.set("wardId", cityWardId);
        } else {
          if (upazilaId) params.set("upazilaId", upazilaId);
          if (unionId) params.set("unionId", unionId);
          if (ruralWardId) params.set("wardId", ruralWardId);
        }

        const url = `/api/areas/by-admin?${params.toString()}`;
        const j = await fetchJSON(url, controller.signal);

        // only those with valid coordinates
        const items = (j.items || []).filter((a) => !!getAreaLatLng(a));
        const allItems = j.items || [];
        setAreas(items);
        setAllAreas(allItems);
        setTotal(j.total || items.length);
        setCentersMatched(j.centersMatched || 0);
        setSelectedId("");

        // fit bounds after load
        if (mapRef.current && items.length && window.google?.maps) {
          const bounds = new window.google.maps.LatLngBounds();
          items.forEach((a) => {
            const pos = getAreaLatLng(a);
            if (pos) bounds.extend(pos);
          });
          if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error(e);
          setAreas([]);
          setTotal(0);
          setCentersMatched(0);
          setSelectedId("");
          setErr(e.message || "Failed to load areas");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [mode, cityId, cityWardId, upazilaId, unionId, ruralWardId]);

  // map default
  const fallbackCenter = useMemo(() => ({ lat: 24.8949, lng: 91.8687 }), []);

  function onMapLoad(map) {
    mapRef.current = map;
    if (!areas.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    areas.forEach((a) => {
      const pos = getAreaLatLng(a);
      if (pos) bounds.extend(pos);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds);
  }

  function onMarkerClick(area) {
    setSelectedId(String(area._id));
    setPanelOpen(true);

    const pos = getAreaLatLng(area);
    if (pos && mapRef.current) {
      mapRef.current.panTo(pos);
      mapRef.current.setZoom(16);
    }
  }

  function clearSelection() {
    setSelectedId("");
  }

  // ---- UI layout:
  // Desktop: Map + right panel
  // Mobile: Map full + bottom drawer panel
  return (
    <div className="h-[calc(100vh-4rem)] w-full relative">
      {/* Top filter bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
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
            <>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value);
                  setCityWardId("");
                }}
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
                onChange={(e) => setCityWardId(e.target.value)}
                disabled={!cityId}
              >
                <option value="">Ward…</option>
                {cityWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={upazilaId}
                onChange={(e) => {
                  setUpazilaId(e.target.value);
                  setUnionId("");
                  setRuralWardId("");
                }}
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
                onChange={(e) => {
                  setUnionId(e.target.value);
                  setRuralWardId("");
                }}
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
                onChange={(e) => setRuralWardId(e.target.value)}
                disabled={!unionId}
              >
                <option value="">Ward…</option>
                {ruralWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Map type toggle */}
          <div className="inline-flex rounded border overflow-hidden ml-1">
            <button
              type="button"
              className={`px-2 py-1 text-[11px] ${
                mapType === "roadmap"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => setMapType("roadmap")}
            >
              Map
            </button>
            <button
              type="button"
              className={`px-2 py-1 text-[11px] ${
                mapType === "hybrid"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => setMapType("hybrid")}
            >
              Satellite
            </button>
          </div>

          <div className="ml-auto text-xs text-gray-600">
            {loading
              ? "Loading…"
              : `${areas.length} points • ${total} areas • ${centersMatched} centers`}
          </div>
        </div>

        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      </div>

      {/* Main: map full */}
      <div className="absolute inset-0 pt-[52px]">
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
            Loading map…
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={fallbackCenter}
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
          >
            {areas.map((a) => {
              const pos = getAreaLatLng(a);
              if (!pos) return null;

              const isSel = String(a._id) === String(selectedId);
              const voters = Number(a.totalVoters || 0);

              // size scaling (safe & visible)
              const size = 32 + Math.min(28, Math.floor(voters / 200)); // 28–56
              const short = a?.name
                ? a.name.length > 14
                  ? a.name.slice(0, 14) + "…"
                  : a.name
                : "Area";
              return (
                <Marker
                  key={a._id}
                  position={pos}
                  onClick={() => onMarkerClick(a)}
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
                  zIndex={isSel ? 999 : 1}
                />
              );
            })}
          </GoogleMap>
        )}
      </div>

      {/* Desktop right panel */}
      <div className="hidden md:block absolute top-[52px] right-0 bottom-0 w-[420px] bg-white border-l z-10 overflow-y-auto">
        <Panel
          selectedArea={selectedArea}
          areas={areas}
          onPick={(a) => onMarkerClick(a)}
        />
      </div>

      {/* Mobile bottom drawer */}
      <div className="md:hidden absolute left-0 right-0 bottom-0 z-10">
        <div className="bg-white border-t rounded-t-2xl shadow-lg">
          <button
            type="button"
            className="w-full py-2 text-xs text-gray-600"
            onClick={() => setPanelOpen((s) => !s)}
          >
            <div className="mx-auto w-10 h-1.5 rounded-full bg-gray-300 mb-1" />
            {panelOpen ? "Hide details" : "Show details"}
          </button>

          {panelOpen && (
            <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
              <Panel
                selectedArea={selectedArea}
                areas={areas}
                onPick={(a) => onMarkerClick(a)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ selectedArea, areas, onPick }) {
  return (
    <div className="p-3 space-y-3">
      {/* Selected */}
      <div className="rounded border bg-gray-50 p-3">
        {!selectedArea ? (
          <div className="text-sm text-gray-700">
            Click an area marker to see details.
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">
              Selected Area
            </div>
            <div className="font-semibold text-gray-900">
              {selectedArea.name}
            </div>
            <div className="text-xs text-gray-900">
              Center :{" "}
              <a
                href={`/centers/${selectedArea.center?._id}`}
                className="text-blue-600 underline"
              >
                {selectedArea.center?.name}
              </a>
            </div>
            <div className="text-xs text-gray-700">
              Total:{" "}
              <span className="font-semibold text-green-700">
                {selectedArea.totalVoters ?? 0}
              </span>{" "}
              • Male: {selectedArea.maleVoters ?? 0} • Female:{" "}
              {selectedArea.femaleVoters ?? 0}
            </div>
            {selectedArea.notes ? (
              <div className="text-xs text-gray-600">{selectedArea.notes}</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded border overflow-hidden">
        <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
          <div className="font-semibold text-sm">Areas</div>
          <div className="text-xs text-gray-500">{areas.length} shown</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[400px] w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-right p-2">Total</th>
                <th className="text-right p-2">M</th>
                <th className="text-right p-2">F</th>
                {/* <th className="text-left p-2">Pin</th> */}
              </tr>
            </thead>
            <tbody>
              {areas.length === 0 ? (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={5}>
                    No areas with location in this filter.
                  </td>
                </tr>
              ) : (
                areas.map((a) => (
                  <tr
                    key={a._id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => onPick(a)}
                  >
                    <td className="p-2 font-medium">{a.name}</td>
                    <td className="p-2 text-right">{a.totalVoters ?? 0}</td>
                    <td className="p-2 text-right">{a.maleVoters ?? 0}</td>
                    <td className="p-2 text-right">{a.femaleVoters ?? 0}</td>
                    {/* <td className="p-2">📍</td> */}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
