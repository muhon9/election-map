"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/* -------- helpers -------- */

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "city_corporation", label: "City Corporation" },
  { value: "upazila", label: "Upazila" },
  { value: "union", label: "Union" },
  { value: "ward", label: "Ward" },
];

function typeLabel(t) {
  const lower = (t || "").toLowerCase();
  if (lower === "city_corporation") return "City Corporation";
  if (lower === "upazila") return "Upazila";
  if (lower === "union") return "Union";
  if (lower === "ward") return "Ward";
  return t || "—";
}

/* -------- page -------- */

export default function GeoListPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // URL-driven filters
  const typeFromUrl = (sp.get("type") || "ward").toLowerCase();
  const [type, setType] = useState(
    TYPE_OPTIONS.some((o) => o.value === typeFromUrl) ? typeFromUrl : "ward"
  );
  const [q, setQ] = useState(sp.get("q") || "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // keep URL in sync when local filters change
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

  // When type changes, sync URL & reload
  useEffect(() => {
    updateUrl({ type });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // When q changes from URL (e.g., when using back/forward), sync local state
  useEffect(() => {
    const qFromUrl = sp.get("q") || "";
    setQ(qFromUrl);
  }, [sp]);

  // Load list when URL filters change
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      setItems([]);

      try {
        const params = [];

        const t = sp.get("type") || type;
        if (t && t !== "all") {
          params.push(`type=${encodeURIComponent(t)}`);
        }

        const qParam = sp.get("q") || "";
        if (qParam.trim()) {
          params.push(`q=${encodeURIComponent(qParam.trim())}`);
        }

        // You can add limit/sort here as needed
        params.push("limit=500");

        const qs = params.length ? `?${params.join("&")}` : "";
        const j = await fetchJSON(`/api/geo${qs}`);

        const list = Array.isArray(j) ? j : j.items || j.data || [];
        if (!alive) return;
        setItems(list);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load geo areas");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
    // We watch the actual URL search params so back/forward works naturally
  }, [sp, type]);

  // Controlled search submit
  function onSearchSubmit(e) {
    e.preventDefault();
    updateUrl({ q: q.trim() || null });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Geo Areas</h1>
          <p className="text-sm text-gray-600">
            Browse wards, unions, upazilas and city corporations. Click a row to
            see its map & centers.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded border bg-white px-3 py-3 flex flex-wrap gap-3 items-center">
        {/* Type selector */}
        <select
          className="border rounded px-2 py-1.5 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <form
          onSubmit={onSearchSubmit}
          className="flex items-center gap-2 flex-1 min-w-[180px]"
        >
          <input
            className="border rounded px-3 py-1.5 text-sm flex-1"
            placeholder="Search by name or code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="text-xs text-gray-500 ml-auto">
          {loading
            ? "Loading…"
            : `${items.length} area${items.length === 1 ? "" : "s"} found`}
        </div>
      </div>

      {/* Table */}
      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Hierarchy</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-gray-600 text-sm">
                  Loading geo areas…
                </td>
              </tr>
            )}

            {!loading && err && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-red-600 text-sm">
                  {err}
                </td>
              </tr>
            )}

            {!loading && !err && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-gray-600 text-sm">
                  No areas found. Try a different type or search text.
                </td>
              </tr>
            )}

            {!loading &&
              !err &&
              items.map((g) => {
                const chain = g.chain || {};
                const crumbs = [];

                if (chain.division) crumbs.push(chain.division.name);
                if (chain.district) crumbs.push(chain.district.name);
                if (
                  chain.city_corporation &&
                  chain.city_corporation._id !== g._id
                )
                  crumbs.push(chain.city_corporation.name);
                if (chain.upazila && chain.upazila._id !== g._id)
                  crumbs.push(chain.upazila.name);
                if (chain.union && chain.union._id !== g._id)
                  crumbs.push(chain.union.name);

                return (
                  <tr
                    key={g._id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/geo/${g._id}`)}
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold">{g.name}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {typeLabel(g.type)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {g.code || "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-500">
                      {crumbs.length ? crumbs.join(" › ") : "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <a
                        href={`/geo/${g._id}`}
                        className="text-blue-600 underline"
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
