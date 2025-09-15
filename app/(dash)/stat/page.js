// app/(dash)/stats/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend as ReLegend,
} from "recharts";
import { useJsApiLoader, GoogleMap, Polygon } from "@react-google-maps/api";

export default function PublicStatsPage() {
  // --- state ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [summary, setSummary] = useState({
    centers: 0,
    areas: 0,
    people: 0,
    votes: 0,
  });
  const [byArea, setByArea] = useState([]); // [{ areaId, areaName, centers, people, votes }]
  const [areasGeo, setAreasGeo] = useState(null); // GeoJSON FeatureCollection (optional)

  // --- load data ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [sRes, aRes, gRes] = await Promise.all([
          fetch("/api/public-stats/summary", { cache: "no-store" }),
          fetch("/api/public-stats/by-area", { cache: "no-store" }),
          fetch("/api/public-stats/areas-geo", { cache: "no-store" }),
        ]);
        const [sJson, aJson, gJson] = await Promise.all([
          sRes.json().catch(() => ({})),
          aRes.json().catch(() => ({})),
          gRes.json().catch(() => ({})),
        ]);
        if (!alive) return;
        if (!sRes.ok) throw new Error(sJson?.error || "Failed to load summary");
        if (!aRes.ok)
          throw new Error(aJson?.error || "Failed to load area stats");
        if (!gRes.ok)
          throw new Error(gJson?.error || "Failed to load map geometry");

        setSummary(
          sJson?.counts || { centers: 0, areas: 0, people: 0, votes: 0 }
        );
        setByArea(aJson?.items || []);
        setAreasGeo(gJson?.type ? gJson : null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load stats");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- map loader ---
  const { isLoaded: mapsReady } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // --- joins & scales ---
  const votesExtent = useMemo(() => {
    if (!byArea?.length) return [0, 0];
    let min = Infinity,
      max = -Infinity;
    for (const d of byArea) {
      const v = Number(d.votes || 0);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    return [min, max];
  }, [byArea]);

  function colorScale(v) {
    // 5-step scale from light to dark. Adjust colors to your brand if needed.
    const [min, max] = votesExtent;
    if (max === min) return "#e5e7eb"; // gray-200 when flat
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    // interpolate between two hues (teal -> indigo)
    const stops = ["#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8"]; // blues
    const idx = Math.min(4, Math.floor(t * 5));
    return stops[idx];
  }

  const areaStatsMap = useMemo(() => {
    const m = new Map();
    for (const d of byArea) m.set(String(d.areaId), d);
    return m;
  }, [byArea]);

  // --- render ---
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Statistics</h1>

      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Centers" value={summary.centers} />
            <KpiCard label="Areas" value={summary.areas} />
            <KpiCard label="People" value={summary.people} />
            <KpiCard label="Total Votes" value={summary.votes} />
          </section>

          {/* Map + Legend */}
          <section className="grid lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 rounded-2xl border bg-white overflow-hidden">
              <div className="p-3 border-b font-medium">
                Votes by Area (Map)
              </div>
              <div className="h-[400px]">
                {mapsReady ? (
                  <ChoroplethMap
                    areasGeo={areasGeo}
                    areaStatsMap={areaStatsMap}
                    colorScale={colorScale}
                  />
                ) : (
                  <div className="h-full grid place-items-center text-sm text-gray-500">
                    Loading map…
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border bg-white">
              <div className="p-3 border-b font-medium">Legend</div>
              <Legend
                min={votesExtent[0]}
                max={votesExtent[1]}
                colorScale={colorScale}
              />
            </div>
          </section>

          {/* Charts */}
          <section className="grid md:grid-cols-2 gap-4">
            <Card title="Votes by Area">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={byArea}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="areaName"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <ReLegend />
                  <Bar dataKey="votes" name="Votes" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Centers & People by Area">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={byArea}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="areaName"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <ReLegend />
                  <Bar dataKey="centers" name="Centers" fill="#10b981" />
                  <Bar dataKey="people" name="People" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </section>

          {/* Data table (simple, readable) */}
          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="p-3 border-b font-medium">Per-area Details</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Area</Th>
                    <Th className="text-right">Votes</Th>
                    <Th className="text-right">Centers</Th>
                    <Th className="text-right">People</Th>
                  </tr>
                </thead>
                <tbody>
                  {byArea.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">
                        No data yet.
                      </td>
                    </tr>
                  ) : (
                    byArea.map((r) => (
                      <tr key={r.areaId} className="border-t">
                        <Td>{r.areaName}</Td>
                        <Td right>{fmtNum(r.votes)}</Td>
                        <Td right>{fmtNum(r.centers)}</Td>
                        <Td right>{fmtNum(r.people)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// --- small components ---
function KpiCard({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{fmtNum(value)}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="p-3 border-b font-medium">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Legend({ min, max, colorScale }) {
  const steps = 5;
  const vals = Array.from({ length: steps }, (_, i) =>
    Math.round(min + ((max - min) * i) / (steps - 1))
  );
  return (
    <div className="p-3">
      {max === min ? (
        <div className="text-sm text-gray-500">No vote variance yet.</div>
      ) : (
        <div className="space-y-2">
          {vals.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block w-8 h-3 rounded"
                style={{ background: colorScale(v) }}
              />
              <span className="text-sm text-gray-700">{fmtNum(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left p-2 ${className}`}>{children}</th>;
}
function Td({ children, right }) {
  return (
    <td className={`p-2 ${right ? "text-right" : "text-left"}`}>{children}</td>
  );
}

function fmtNum(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat().format(v);
}

// --- Choropleth Map ---
function ChoroplethMap({ areasGeo, areaStatsMap, colorScale }) {
  const defaultCenter = { lat: 23.777176, lng: 90.399452 }; // Dhaka fallback
  const [map, setMap] = useState(null);

  // Build polygon overlays from GeoJSON (if provided)
  const polys = useMemo(() => {
    if (!areasGeo || areasGeo?.type !== "FeatureCollection") return [];
    const out = [];
    for (const f of areasGeo.features || []) {
      const id = String(f.properties?.id ?? f.id ?? "");
      const stat = areaStatsMap.get(id);
      const votes = Number(stat?.votes || 0);
      const fillColor = colorScale(votes);

      // Support Polygon & MultiPolygon (GeoJSON)
      const g = f.geometry || {};
      if (g.type === "Polygon") {
        const rings = g.coordinates || [];
        out.push({
          id,
          rings,
          fillColor,
          votes,
          name: stat?.areaName || f.properties?.name || id,
        });
      } else if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates || []) {
          out.push({
            id,
            rings: poly,
            fillColor,
            votes,
            name: stat?.areaName || f.properties?.name || id,
          });
        }
      }
    }
    return out;
  }, [areasGeo, areaStatsMap, colorScale]);

  // Fit bounds to all polygons
  useEffect(() => {
    if (!map || polys.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    for (const poly of polys) {
      for (const ring of poly.rings) {
        for (const [lng, lat] of ring) bounds.extend({ lat, lng }); // GeoJSON => [lng, lat]
      }
    }
    try {
      map.fitBounds(bounds);
    } catch {}
  }, [map, polys]);

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={defaultCenter}
      zoom={7}
      onLoad={(m) => setMap(m)}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {polys.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-gray-500">
          No area geometry yet.
        </div>
      ) : (
        polys.map((p, idx) => (
          <Polygon
            key={`${p.id}-${idx}`}
            paths={p.rings.map((ring) =>
              ring.map(([lng, lat]) => ({ lat, lng }))
            )}
            options={{
              fillColor: p.fillColor,
              fillOpacity: 0.6,
              strokeColor: "#334155",
              strokeWeight: 1,
              clickable: false,
            }}
          />
        ))
      )}
    </GoogleMap>
  );
}

// ==============================
// OPTIONAL: Public stats API stubs
// Create these files if you want to wire the page now and fill real data later.
// ==============================

/**
 * // app/api/public-stats/summary/route.js
 * import db from "@/lib/db";
 * import Center from "@/models/Center"; import Area from "@/models/Area"; import Person from "@/models/Person";
 * export async function GET() {
 *   await db();
 *   // TODO: replace with real counts
 *   const [centers, areas, people] = await Promise.all([
 *     Center.countDocuments({}),
 *     Area.countDocuments({}),
 *     Person.countDocuments({}),
 *   ]);
 *   // If you have a Vote collection, sum here; otherwise compute from People/Center
 *   const votes = 0; // placeholder
 *   return Response.json({ counts: { centers, areas, people, votes } });
 * }
 */

/**
 * // app/api/public-stats/by-area/route.js
 * import db from "@/lib/db";
 * import Area from "@/models/Area"; import Center from "@/models/Center"; import Person from "@/models/Person";
 * export async function GET() {
 *   await db();
 *   // Example aggregation; customize to your schema
 *   const centersAgg = await Center.aggregate([
 *     { $group: { _id: "$area", centers: { $sum: 1 } } },
 *   ]);
 *   const peopleAgg = await Person.aggregate([
 *     { $group: { _id: "$area", people: { $sum: 1 } } },
 *   ]);
 *   const votesAgg = []; // TODO: add if you have votes; shape: [{ _id: areaId, votes: <num> }]
 *   const map = new Map();
 *   for (const c of centersAgg) map.set(String(c._id), { areaId: String(c._id), centers: c.centers, people: 0, votes: 0 });
 *   for (const p of peopleAgg) {
 *     const k = String(p._id);
 *     map.set(k, { ...(map.get(k) || { areaId: k, centers: 0, people: 0, votes: 0 }), people: p.people });
 *   }
 *   for (const v of votesAgg) {
 *     const k = String(v._id);
 *     map.set(k, { ...(map.get(k) || { areaId: k, centers: 0, people: 0, votes: 0 }), votes: v.votes });
 *   }
 *   const areas = await Area.find({}, { name: 1 }).lean();
 *   const nameMap = new Map(areas.map(a => [String(a._id), a.name]));
 *   const items = Array.from(map.values()).map(r => ({ ...r, areaName: nameMap.get(r.areaId) || r.areaId }));
 *   return Response.json({ items });
 * }
 */

/**
 * // app/api/public-stats/areas-geo/route.js
 * // Return a GeoJSON FeatureCollection of area polygons. If you don't have geometry, return { type: "FeatureCollection", features: [] }
 * import db from "@/lib/db";
 * import Area from "@/models/Area"; // assume Area has geo: { type: 'MultiPolygon'|'Polygon', coordinates: [...] }
 * export async function GET() {
 *   await db();
 *   const areas = await Area.find({ geo: { $exists: true } }, { name: 1, geo: 1 }).lean();
 *   const fc = {
 *     type: "FeatureCollection",
 *     features: areas.map(a => ({ type: "Feature", id: String(a._id), properties: { id: String(a._id), name: a.name }, geometry: a.geo })),
 *   };
 *   return Response.json(fc);
 * }
 */
