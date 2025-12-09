"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function usePerms() {
  const { data } = useSession();
  const perms = data?.user?.permissions || data?.permissions || [];
  const has = (p) => perms?.includes?.(p);
  return { perms, has };
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function CentersPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { has } = usePerms();

  // ---- Initial state from URL ----
  const initPage = parseInt(sp.get("page") || "1", 10);
  const initLimit = parseInt(sp.get("limit") || "10", 10);
  const initQ = sp.get("q") || "";
  const initSort = sp.get("sort") || "totalVoters";
  const initDir = sp.get("dir") || "desc";

  const initMode = sp.get("mode") === "rural" ? "rural" : "city";

  const initCityId = sp.get("cityId") || "";
  const initCityWardId = sp.get("cityWardId") || "";
  const initUpazilaId = sp.get("upazilaId") || "";
  const initUnionId = sp.get("unionId") || "";
  const initRuralWardId = sp.get("ruralWardId") || "";
  const initVoterRange = sp.get("vr") || "";

  const [page, setPage] = useState(initPage);
  const [limit, setLimit] = useState(initLimit);
  const [q, setQ] = useState(initQ);
  const [sort, setSort] = useState(initSort);
  const [dir, setDir] = useState(initDir);

  const [mode, setMode] = useState(initMode);

  // Geo filter state
  const [cityId, setCityId] = useState(initCityId);
  const [cityWardId, setCityWardId] = useState(initCityWardId);
  const [upazilaId, setUpazilaId] = useState(initUpazilaId);
  const [unionId, setUnionId] = useState(initUnionId);
  const [ruralWardId, setRuralWardId] = useState(initRuralWardId);
  const [voterRange, setVoterRange] = useState(initVoterRange);

  // Geo lists
  const [cities, setCities] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErr, setGeoErr] = useState("");

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: limit,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // ---- Load top-level geo: City corps + Upazilas ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setGeoLoading(true);
        setGeoErr("");
        const [cc, upa] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        if (!alive) return;
        setCities(cc.items || []);
        setUpazilas(upa.items || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setGeoErr("Failed to load geo filters (cities/upazilas).");
      } finally {
        if (alive) setGeoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- Load city wards when cityId changes ----
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(
          `/api/geo?parentId=${encodeURIComponent(cityId)}&active=1`
        );
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

  // ---- Load unions when upazilaId changes ----
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(
          `/api/geo?parentId=${encodeURIComponent(upazilaId)}&active=1`
        );
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

  // ---- Load rural wards when unionId changes ----
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(
          `/api/geo?parentId=${encodeURIComponent(unionId)}&active=1`
        );
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

  // ---- Keep URL in sync ----
  useEffect(() => {
    const params = new URLSearchParams();

    if (page > 1) params.set("page", String(page));
    if (limit !== 10) params.set("limit", String(limit));
    if (q) params.set("q", q);
    if (sort !== "createdAt") params.set("sort", sort);
    if (dir !== "desc") params.set("dir", dir);

    params.set("mode", mode); // always include for clarity

    if (mode === "city") {
      if (cityId) params.set("cityId", cityId);
      if (cityWardId) params.set("cityWardId", cityWardId);
      // clear rural params
      params.delete("upazilaId");
      params.delete("unionId");
      params.delete("ruralWardId");
    } else {
      if (upazilaId) params.set("upazilaId", upazilaId);
      if (unionId) params.set("unionId", unionId);
      if (ruralWardId) params.set("ruralWardId", ruralWardId);
      // clear city params
      params.delete("cityId");
      params.delete("cityWardId");
    }

    if (voterRange) params.set("vr", voterRange);

    const qs = params.toString();
    router.replace(qs ? `/centers?${qs}` : `/centers`);
  }, [
    page,
    limit,
    q,
    sort,
    dir,
    mode,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
    voterRange,
    router,
  ]);

  // ---- Fetch data when state changes ----
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        let url = `/api/centers?page=${page}&limit=${limit}&q=${encodeURIComponent(
          q
        )}&sort=${sort}&dir=${dir}`;

        if (mode === "city") {
          if (cityId) url += `&cityId=${encodeURIComponent(cityId)}`;
          if (cityWardId) url += `&wardId=${encodeURIComponent(cityWardId)}`;
        } else {
          if (upazilaId) url += `&upazilaId=${encodeURIComponent(upazilaId)}`;
          if (unionId) url += `&unionId=${encodeURIComponent(unionId)}`;
          if (ruralWardId) url += `&wardId=${encodeURIComponent(ruralWardId)}`;
        }

        if (voterRange) url += `&vr=${encodeURIComponent(voterRange)}`;

        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = await res.json();
        if (res.ok) setData(json);
        else console.error(json);
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    page,
    limit,
    q,
    sort,
    dir,
    mode,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
    voterRange,
  ]);

  // ---- Sorting ----
  function toggleSort(field) {
    if (sort === field) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDir("asc");
    }
    setPage(1);
  }

  function gotoPage(p) {
    const target = Math.max(1, Math.min(data.pages || 1, p));
    setPage(target);
  }

  function onLimitChange(e) {
    setLimit(parseInt(e.target.value, 10));
    setPage(1);
  }

  function chooseMode(next) {
    if (next === mode) return;
    setMode(next);
    setPage(1);

    if (next === "city") {
      // clear rural filters
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      // clear city filters
      setCityId("");
      setCityWardId("");
    }
  }

  // ---- Pagination window ----
  const pageWindow = useMemo(() => {
    const pages = data.pages || 1;
    const cur = page;
    const windowSize = 5;
    const start = Math.max(1, cur - Math.floor(windowSize / 2));
    const end = Math.min(pages, start + windowSize - 1);
    const fixedStart = Math.max(1, end - windowSize + 1);
    return Array.from(
      { length: end - fixedStart + 1 },
      (_, i) => fixedStart + i
    );
  }, [data.pages, page]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Centers</h1>
        {has("add_center") && (
          <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => (window.location.href = "/centers/new")}
          >
            New Center
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: search + page size */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm w-64"
            placeholder="Search (name, address, contact)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="border rounded px-2 py-2 text-sm"
            value={limit}
            onChange={onLimitChange}
            title="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>

        {/* Right: mode + filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode toggle */}
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
              Sylhet Sadar / Upazila
            </button>
          </div>

          {/* City filters */}
          {mode === "city" ? (
            <>
              <select
                className="border rounded px-2 py-2 text-sm"
                value={cityId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCityId(val);
                  setCityWardId("");
                  setPage(1);
                }}
              >
                <option value="">All City Corporations</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-2 text-sm"
                value={cityWardId}
                onChange={(e) => {
                  setCityWardId(e.target.value);
                  setPage(1);
                }}
                disabled={!cityId}
              >
                <option value="">All Wards</option>
                {cityWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            // Rural filters
            <>
              <select
                className="border rounded px-2 py-2 text-sm"
                value={upazilaId}
                onChange={(e) => {
                  const val = e.target.value;
                  setUpazilaId(val);
                  setUnionId("");
                  setRuralWardId("");
                  setPage(1);
                }}
              >
                <option value="">All Upazilas</option>
                {upazilas.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-2 text-sm"
                value={unionId}
                onChange={(e) => {
                  const val = e.target.value;
                  setUnionId(val);
                  setRuralWardId("");
                  setPage(1);
                }}
                disabled={!upazilaId}
              >
                <option value="">All Unions</option>
                {unions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-2 text-sm"
                value={ruralWardId}
                onChange={(e) => {
                  setRuralWardId(e.target.value);
                  setPage(1);
                }}
                disabled={!unionId}
              >
                <option value="">All Wards</option>
                {ruralWards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Voter range filter */}
          <select
            className="border rounded px-2 py-2 text-sm"
            value={voterRange}
            onChange={(e) => {
              setVoterRange(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Voters: All</option>
            <option value="0-500">0–500</option>
            <option value="500-1500">500–1500</option>
            <option value="1500-3000">1500–3000</option>
            <option value="3000-999999">3000+</option>
          </select>
        </div>
      </div>

      {geoLoading && (
        <div className="text-xs text-gray-500">
          Loading geo filters (cities/wards/upazilas)…
        </div>
      )}
      {geoErr && <div className="text-xs text-red-600">{geoErr}</div>}

      {/* Table */}
      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <Th sort={sort} dir={dir} field="name" onSort={toggleSort}>
                Name
              </Th>
              <th className="text-left p-2">Address</th>
              <Th sort={sort} dir={dir} field="totalVoters" onSort={toggleSort}>
                Total
              </Th>
              <th className="text-left p-2">M/F</th>
              <th className="text-left p-2">Areas</th>
              <th className="text-left p-2 w-[160px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && data.items.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  No centers found.
                </td>
              </tr>
            )}

            {!loading &&
              data.items.map((c) => (
                <Row
                  key={c._id}
                  c={c}
                  canEdit={has("edit_center")}
                  canDelete={has("delete_center")}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          Page <span className="font-medium">{data.page}</span> of{" "}
          <span className="font-medium">{data.pages}</span> •{" "}
          <span className="font-medium">{data.total}</span> total
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => gotoPage(page - 1)}
            disabled={page <= 1}
          >
            Prev
          </button>
          {pageWindow.map((p) => (
            <button
              key={p}
              className={`px-3 py-1.5 border rounded text-sm ${
                p === page ? "bg-blue-600 text-white border-blue-600" : ""
              }`}
              onClick={() => gotoPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => gotoPage(page + 1)}
            disabled={page >= (data.pages || 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, sort, dir, field, onSort }) {
  const active = sort === field;
  return (
    <th
      className="text-left p-2 select-none"
      onClick={() => onSort(field)}
      role="button"
      title="Sort"
    >
      <span className="inline-flex items-center gap-1 cursor-pointer">
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}

function Row({ c, canEdit, canDelete }) {
  const onRowClick = () => {
    window.location.href = `/centers/${c._id}`;
  };

  const onEdit = (e) => {
    e.stopPropagation();
    window.location.href = `/centers/${c._id}/edit`;
  };

  const onDelete = async (e) => {
    e.stopPropagation();
    if (!canDelete) return;
    if (!confirm(`Delete center "${c.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/centers/${c._id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete");
      return;
    }
    window.location.reload();
  };

  return (
    <tr
      className="border-t hover:bg-gray-50 cursor-pointer"
      onClick={onRowClick}
    >
      <td className="p-2 font-medium">{c.name}</td>
      <td className="p-2">{c.address || "—"}</td>
      <td className="p-2">{c.totalVoters ?? 0}</td>
      <td className="p-2">
        {c.maleVoters ?? 0} / {c.femaleVoters ?? 0}
      </td>
      <td className="p-2">{c.areasCount}</td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              className="px-2 py-1 text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
              onClick={onEdit}
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              className="px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          {!canEdit && !canDelete && (
            <span className="text-xs text-gray-400">No actions</span>
          )}
        </div>
      </td>
    </tr>
  );
}
