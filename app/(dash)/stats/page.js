"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// --- helpers ---

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const CARD_CLASS =
  "rounded border bg-white px-4 py-3 flex flex-col justify-between";

// --- page ---

export default function VoterStatsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // URL-driven filters
  const mode = sp.get("mode") === "rural" ? "rural" : "city";

  const cityId = sp.get("cityId") || "";
  const wardId = sp.get("wardId") || "";
  const upazilaId = sp.get("upazilaId") || "";
  const unionId = sp.get("unionId") || "";

  // geo lists
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  // stats data
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsErr, setStatsErr] = useState("");

  const [loadingGeo, setLoadingGeo] = useState(false);

  // URL helper
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

  // top-level geo: city corps + upazilas
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

  // cityId → wards
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
        console.error("Failed loading city wards", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityId]);

  // upazilaId → unions
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      setRuralWards([]);
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
        console.error("Failed loading unions", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [upazilaId]);

  // unionId → rural wards
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
        console.error("Failed loading rural wards", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unionId]);

  // mode toggle
  function chooseMode(next) {
    if (next === "city") {
      updateQuery({
        mode: "city",
        cityId: cityId || null,
        wardId: wardId || null,
        upazilaId: null,
        unionId: null,
      });
    } else {
      updateQuery({
        mode: "rural",
        upazilaId: upazilaId || null,
        unionId: unionId || null,
        wardId: wardId || null,
        cityId: null,
      });
    }
  }

  // fetch stats whenever filters change
  useEffect(() => {
    let alive = true;

    async function loadStats() {
      setLoadingStats(true);
      setStatsErr("");
      setStats(null);

      try {
        const params = [];

        if (mode === "city") {
          if (cityId) params.push(`cityId=${encodeURIComponent(cityId)}`);
          if (wardId) params.push(`wardId=${encodeURIComponent(wardId)}`);
        } else {
          if (upazilaId)
            params.push(`upazilaId=${encodeURIComponent(upazilaId)}`);
          if (unionId) params.push(`unionId=${encodeURIComponent(unionId)}`);
          if (wardId) params.push(`wardId=${encodeURIComponent(wardId)}`);
        }

        const qs = params.length ? `?${params.join("&")}` : "";
        const j = await fetchJSON(`/api/stats/voters${qs}`);
        if (!alive) return;
        setStats(j);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setStatsErr(e.message || "Failed to load stats");
      } finally {
        if (alive) setLoadingStats(false);
      }
    }

    loadStats();
    return () => {
      alive = false;
    };
  }, [mode, cityId, upazilaId, unionId, wardId]);

  const totals = stats?.totals || { total: 0, male: 0, female: 0 };
  const centersCount = stats?.centers ?? 0;

  const malePct = useMemo(() => {
    const denom = totals.male + totals.female;
    return denom > 0 ? Math.round((totals.male / denom) * 100) : 0;
  }, [totals.male, totals.female]);

  const femalePct = useMemo(() => {
    const denom = totals.male + totals.female;
    return denom > 0 ? Math.round((totals.female / denom) * 100) : 0;
  }, [totals.male, totals.female]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Voter Stats Overview</h1>
          <p className="text-sm text-gray-600">
            High-level voter statistics with top centers, areas, wards and
            unions.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <section className="rounded border bg-white px-3 py-3 space-y-3">
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

          {/* City mode filters */}
          {mode === "city" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={cityId}
                onChange={(e) =>
                  updateQuery({
                    mode: "city",
                    cityId: e.target.value || null,
                    wardId: null,
                  })
                }
              >
                <option value="">All City Corporations…</option>
                {cityCorps.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={wardId}
                onChange={(e) =>
                  updateQuery({
                    mode: "city",
                    wardId: e.target.value || null,
                  })
                }
                disabled={!cityId}
              >
                <option value="">All Wards…</option>
                {cityWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            // Rural mode filters
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={upazilaId}
                onChange={(e) =>
                  updateQuery({
                    mode: "rural",
                    upazilaId: e.target.value || null,
                    unionId: null,
                    wardId: null,
                  })
                }
              >
                <option value="">All Upazilas…</option>
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
                    wardId: null,
                  })
                }
                disabled={!upazilaId}
              >
                <option value="">All Unions…</option>
                {unions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={wardId}
                onChange={(e) =>
                  updateQuery({
                    mode: "rural",
                    wardId: e.target.value || null,
                  })
                }
                disabled={!unionId}
              >
                <option value="">All Wards…</option>
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
              : loadingStats
              ? "Loading stats…"
              : ""}
          </div>
        </div>

        {statsErr && <div className="text-xs text-red-600">{statsErr}</div>}
      </section>

      {/* Summary cards + gender breakdown */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          title="Total voters"
          value={totals.total}
          accent="text-green-700"
        />
        <SummaryCard title="Male voters" value={totals.male} />
        <SummaryCard title="Female voters" value={totals.female} />
        <SummaryCard title="Centers in scope" value={centersCount} />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">Gender breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Male bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Male</span>
              <span>{malePct}%</span>
            </div>
            <div className="w-full h-3 rounded bg-gray-200 overflow-hidden mt-1">
              <div
                className="h-3"
                style={{
                  width: `${malePct}%`,
                  backgroundColor: "#60a5fa", // blue-400
                }}
              />
            </div>
          </div>

          {/* Female bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Female</span>
              <span>{femalePct}%</span>
            </div>
            <div className="w-full h-3 rounded bg-gray-200 overflow-hidden mt-1">
              <div
                className="h-3"
                style={{
                  width: `${femalePct}%`,
                  backgroundColor: "#f472b6", // pink-400
                }}
              />
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Total considered: {totals.male + totals.female} (male + female).[
          Overall centers: {centersCount}].
        </div>
      </section>

      {/* Top lists */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCentersTable topCenters={stats?.topCenters || []} />
        <TopAreasTable topAreas={stats?.topAreas || []} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopGeoTable
          title="Top wards by voters"
          rows={stats?.topWards || []}
          type="ward"
        />
        <TopGeoTable
          title="Top unions by voters"
          rows={stats?.topUnions || []}
          type="union"
        />
      </section>
    </div>
  );
}

// --- small components ---

function SummaryCard({ title, value, accent = "" }) {
  return (
    <div className={CARD_CLASS}>
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${accent}`}>{value ?? 0}</div>
    </div>
  );
}

function TopCentersTable({ topCenters }) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Top 10 centers by voters</h2>
      </div>
      {topCenters.length === 0 ? (
        <div className="text-xs text-gray-500">No data for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Center</th>
                <th className="text-right p-2">Total</th>
                <th className="text-right p-2">Male</th>
                <th className="text-right p-2">Female</th>
              </tr>
            </thead>
            <tbody>
              {topCenters.map((c) => (
                <tr
                  key={c._id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => (window.location.href = `/centers/${c._id}`)}
                >
                  <td className="p-2 align-top">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {c.address || "—"}
                    </div>
                  </td>
                  <td className="p-2 text-right">{c.totalVoters ?? 0}</td>
                  <td className="p-2 text-right">{c.maleVoters ?? 0}</td>
                  <td className="p-2 text-right">{c.femaleVoters ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopAreasTable({ topAreas }) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Top 10 areas by voters</h2>
      </div>
      {topAreas.length === 0 ? (
        <div className="text-xs text-gray-500">No data for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Area</th>
                <th className="text-right p-2">Voters</th>
                <th className="text-left p-2">Center</th>
              </tr>
            </thead>
            <tbody>
              {topAreas.map((a) => (
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="p-2 align-top">
                    <div className="font-semibold truncate">{a.name}</div>
                  </td>
                  <td className="p-2 text-right">{a.totalVoters ?? 0}</td>
                  <td className="p-2 align-top">
                    {a.centerId ? (
                      <a
                        className="text-blue-600 underline"
                        href={`/centers/${a.centerId}`}
                      >
                        {a.centerName || "Center"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopGeoTable({ title, rows, type }) {
  // type: "ward" | "union"
  const idKey = type === "ward" ? "wardId" : "unionId";
  const nameKey = type === "ward" ? "wardName" : "unionName";

  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-gray-500">No data for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">
                  {type === "ward" ? "Ward" : "Union"}
                </th>
                <th className="text-right p-2">Centers</th>
                <th className="text-right p-2">Total</th>
                <th className="text-right p-2">Male</th>
                <th className="text-right p-2">Female</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r[idKey]}
                  className="border-t hover:bg-gray-50"
                  onClick={() => (window.location.href = `/geo/${r[idKey]}`)}
                >
                  <td className="p-2 align-top">
                    {r[idKey] ? (
                      <a
                        className="text-blue-600 underline"
                        href={`/geo/${r[idKey]}`}
                      >
                        {r[nameKey] || "—"}
                      </a>
                    ) : (
                      r[nameKey] || "—"
                    )}
                  </td>
                  <td className="p-2 text-right">{r.centers ?? 0}</td>
                  <td className="p-2 text-right">{r.totalVoters ?? 0}</td>
                  <td className="p-2 text-right">{r.maleVoters ?? 0}</td>
                  <td className="p-2 text-right">{r.femaleVoters ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
