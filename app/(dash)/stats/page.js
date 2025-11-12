"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

// Small card component
function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

export default function StatsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const canView = has(user, "view_centers");

  const [mode, setMode] = useState("city"); // "city" | "rural"

  // Overall totals
  const [overall, setOverall] = useState({
    centers: 0,
    totals: { total: 0, male: 0, female: 0 },
  });
  const [loadingOverall, setLoadingOverall] = useState(true);

  // Geo options
  const [cityCorps, setCityCorps] = useState([]);
  const [upazilas, setUpazilas] = useState([]);

  // Selections
  const [cityId, setCityId] = useState("");
  const [cityWards, setCityWards] = useState([]);
  const [cityTotals, setCityTotals] = useState(null);
  const [cityWardRows, setCityWardRows] = useState([]);
  const [loadingCity, setLoadingCity] = useState(false);

  const [upazilaId, setUpazilaId] = useState("");
  const [unions, setUnions] = useState([]);
  const [upaTotals, setUpaTotals] = useState(null);
  const [unionRows, setUnionRows] = useState([]);
  const [unionId, setUnionId] = useState("");
  const [wardRows, setWardRows] = useState([]);
  const [loadingUpa, setLoadingUpa] = useState(false);

  // ---------- helpers ----------
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  function qs(obj) {
    const sp = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
    return sp.toString();
  }

  async function fetchTotals({ cityId, upazilaId, unionId, wardId } = {}) {
    const query = qs({
      cityId,
      upazilaId,
      unionId,
      wardId,
    });
    const url = `/api/stats/voters${query ? `?${query}` : ""}`;
    return fetchJSON(url);
  }

  // ---------- load overall + top-level geos ----------
  useEffect(() => {
    (async () => {
      try {
        setLoadingOverall(true);
        const [ov, cities, upas] = await Promise.all([
          fetchTotals(), // overall
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        setOverall({ centers: ov.centers, totals: ov.totals });
        setCityCorps(cities.items || []);
        setUpazilas(upas.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOverall(false);
      }
    })();
  }, []);

  // ---------- city path ----------
  useEffect(() => {
    (async () => {
      if (!cityId) {
        setCityWards([]);
        setCityTotals(null);
        setCityWardRows([]);
        return;
      }
      setLoadingCity(true);
      try {
        // parent totals
        const [tot, wardsRes] = await Promise.all([
          fetchTotals({ cityId }),
          fetchJSON(`/api/geo?parentId=${cityId}&active=1`),
        ]);
        setCityTotals(tot);
        const wards = wardsRes.items || [];
        setCityWards(wards);

        // per-ward totals (parallel, but safe)
        const wardTotals = await Promise.all(
          wards.map((w) =>
            fetchTotals({ cityId, wardId: w._id }).then((t) => ({
              _id: w._id,
              name: w.name,
              centers: t.centers || 0,
              total: t.totals?.total || 0,
              male: t.totals?.male || 0,
              female: t.totals?.female || 0,
            }))
          )
        );
        setCityWardRows(wardTotals);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCity(false);
      }
    })();
  }, [cityId]);

  // ---------- upazila path ----------
  useEffect(() => {
    (async () => {
      if (!upazilaId) {
        setUpaTotals(null);
        setUnions([]);
        setUnionRows([]);
        setUnionId("");
        setWardRows([]);
        return;
      }
      setLoadingUpa(true);
      try {
        // parent totals + unions
        const [tot, unionsRes] = await Promise.all([
          fetchTotals({ upazilaId: upazilaId }),
          fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`),
        ]);
        setUpaTotals(tot);
        const us = unionsRes.items || [];
        setUnions(us);

        // per-union totals
        const unionTotals = await Promise.all(
          us.map((u) =>
            fetchTotals({ upazilaId, unionId: u._id }).then((t) => ({
              _id: u._id,
              name: u.name,
              centers: t.centers || 0,
              total: t.totals?.total || 0,
              male: t.totals?.male || 0,
              female: t.totals?.female || 0,
            }))
          )
        );
        setUnionRows(unionTotals);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingUpa(false);
      }
    })();
  }, [upazilaId]);

  // wards under selected union
  useEffect(() => {
    (async () => {
      if (!upazilaId || !unionId) {
        setWardRows([]);
        return;
      }
      try {
        const wardsRes = await fetchJSON(
          `/api/geo?parentId=${unionId}&active=1`
        );
        const wards = wardsRes.items || [];
        const wardTotals = await Promise.all(
          wards.map((w) =>
            fetchTotals({ upazilaId, unionId, wardId: w._id }).then((t) => ({
              _id: w._id,
              name: w.name,
              centers: t.centers || 0,
              total: t.totals?.total || 0,
              male: t.totals?.male || 0,
              female: t.totals?.female || 0,
            }))
          )
        );
        setWardRows(wardTotals);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [unionId, upazilaId]);

  const overallCards = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Total Centers"
        value={loadingOverall ? "…" : overall.centers}
      />
      <StatCard
        label="Total Voters"
        value={loadingOverall ? "…" : overall.totals.total}
      />
      <StatCard
        label="Male Voters"
        value={loadingOverall ? "…" : overall.totals.male}
      />
      <StatCard
        label="Female Voters"
        value={loadingOverall ? "…" : overall.totals.female}
      />
    </div>
  );

  function Table({ rows, loading }) {
    return (
      <div className="rounded-xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-right p-2">Centers</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2">Male</th>
              <th className="text-right p-2">Female</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-3 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-gray-500">
                  No data
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r._id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">{r.centers}</td>
                  <td className="p-2 text-right">{r.total}</td>
                  <td className="p-2 text-right">{r.male}</td>
                  <td className="p-2 text-right">{r.female}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        You don’t have permission to view center stats.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Center & Voter Stats</h1>
      </header>

      {/* Overall */}
      {overallCards}

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">
          View by Geography
        </span>
        <button
          className={`px-2 py-1 border rounded ${
            mode === "city" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
          }`}
          onClick={() => {
            setMode("city");
            // clear rural selections
            setUpazilaId("");
            setUnionId("");
            setWardRows([]);
          }}
        >
          City Corporation → Ward
        </button>
        <button
          className={`px-2 py-1 border rounded ${
            mode === "rural" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
          }`}
          onClick={() => {
            setMode("rural");
            // clear city selections
            setCityId("");
          }}
        >
          Upazila → Union → Ward
        </button>
      </div>

      {/* City mode */}
      {mode === "city" && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Corporation
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">— Select City Corporation —</option>
                {cityCorps.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            {/* City totals */}
            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <StatCard
                label="Centers"
                value={cityTotals?.centers ?? (cityId ? "…" : "-")}
              />
              <StatCard
                label="Total Voters"
                value={cityTotals?.totals?.total ?? (cityId ? "…" : "-")}
              />
              <StatCard
                label="Male / Female"
                value={
                  cityTotals
                    ? `${cityTotals.totals.male} / ${cityTotals.totals.female}`
                    : cityId
                    ? "…"
                    : "-"
                }
              />
            </div>
          </div>

          {/* Ward breakdown */}
          <Table rows={cityWardRows} loading={loadingCity && !!cityId} />
        </section>
      )}

      {/* Rural mode */}
      {mode === "rural" && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upazila
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={upazilaId}
                onChange={(e) => {
                  setUpazilaId(e.target.value);
                  setUnionId("");
                  setWardRows([]);
                }}
              >
                <option value="">— Select Upazila —</option>
                {upazilas.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Upazila totals */}
            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <StatCard
                label="Centers"
                value={upaTotals?.centers ?? (upazilaId ? "…" : "-")}
              />
              <StatCard
                label="Total Voters"
                value={upaTotals?.totals?.total ?? (upazilaId ? "…" : "-")}
              />
              <StatCard
                label="Male / Female"
                value={
                  upaTotals
                    ? `${upaTotals.totals.male} / ${upaTotals.totals.female}`
                    : upazilaId
                    ? "…"
                    : "-"
                }
              />
            </div>
          </div>

          {/* Union breakdown */}
          <Table rows={unionRows} loading={loadingUpa && !!upazilaId} />

          {/* Optional: choose one union to see its wards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                View Wards of a Union (optional)
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={unionId}
                onChange={(e) => setUnionId(e.target.value)}
                disabled={!upazilaId}
              >
                <option value="">— Select Union —</option>
                {unions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {unionId ? (
            <>
              <div className="text-sm text-gray-700">
                Wards under selected Union
              </div>
              <Table rows={wardRows} loading={false} />
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
