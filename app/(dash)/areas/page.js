"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import { useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export default function AreasPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const { data: session } = useSession();
  const user = session?.user;

  const canAdd = has(user, "add_center"); // reuse center perms for now
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  // --------------------
  // URL -> initial state
  // --------------------
  const initMode = sp.get("mode") === "rural" ? "rural" : "city";

  const initCityId = sp.get("cityId") || "";
  const initUpazilaId = sp.get("upazilaId") || "";
  const initUnionId = sp.get("unionId") || "";

  // IMPORTANT: wardId in URL is shared key, so decide based on initMode
  const initWardId = sp.get("wardId") || "";
  const initCityWardId = initMode === "city" ? initWardId : "";
  const initRuralWardId = initMode === "rural" ? initWardId : "";

  const initCenterId = sp.get("centerId") || "";

  const initPage = parseInt(sp.get("page") || "1", 10);
  const initLimit = parseInt(sp.get("limit") || "10", 10);
  const initQ = sp.get("q") || "";
  const initSort = sp.get("sort") || "totalVoters";
  const initDir = sp.get("dir") || "desc";

  // --------------------
  // State
  // --------------------
  const [mode, setMode] = useState(initMode);

  const [cityId, setCityId] = useState(initCityId);
  const [cityWardId, setCityWardId] = useState(initCityWardId);

  const [upazilaId, setUpazilaId] = useState(initUpazilaId);
  const [unionId, setUnionId] = useState(initUnionId);
  const [ruralWardId, setRuralWardId] = useState(initRuralWardId);

  const [centerId, setCenterId] = useState(initCenterId);

  const [page, setPage] = useState(initPage);
  const [limit, setLimit] = useState(initLimit);
  const [q, setQ] = useState(initQ);
  const [sort, setSort] = useState(initSort);
  const [dir, setDir] = useState(initDir);

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: initPage,
    pageSize: initLimit,
    pages: 1,
    centersMatched: 0,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // --------------------
  // Geo dropdown data
  // --------------------
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  // Load top-level geo
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

  // City changed -> load wards
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

  // Upazila changed -> load unions
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

  // Union changed -> load rural wards
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

  // --------------------
  // Mode switch
  // --------------------
  function chooseMode(next) {
    setMode(next);
    setCenterId("");
    setPage(1);

    if (next === "city") {
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      setCityId("");
      setCityWardId("");
    }
  }

  // If user picks centerId, clear admin filters to avoid confusion
  useEffect(() => {
    if (!centerId) return;
    setCityId("");
    setCityWardId("");
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
    setPage(1);
  }, [centerId]);

  // --------------------
  // Keep URL in sync
  // --------------------
  useEffect(() => {
    const params = new URLSearchParams();

    params.set("mode", mode);

    if (page > 1) params.set("page", String(page));
    if (limit !== 10) params.set("limit", String(limit));
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);

    if (centerId) {
      params.set("centerId", centerId);
    } else if (mode === "city") {
      if (cityId) params.set("cityId", cityId);
      if (cityWardId) params.set("wardId", cityWardId);
    } else {
      if (upazilaId) params.set("upazilaId", upazilaId);
      if (unionId) params.set("unionId", unionId);
      if (ruralWardId) params.set("wardId", ruralWardId);
    }

    const qs = params.toString();
    router.replace(qs ? `/areas?${qs}` : `/areas`);
  }, [
    mode,
    page,
    limit,
    q,
    sort,
    dir,
    centerId,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
    router,
  ]);

  // --------------------
  // Fetch from /api/areas/by-admin
  // (Now it returns ALL areas if no filters)
  // --------------------
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErr("");

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", sort);
        params.set("dir", dir);
        if (q) params.set("q", q);

        if (centerId) {
          params.set("centerId", centerId);
        } else {
          params.set("mode", mode);
          if (mode === "city") {
            if (cityId) params.set("cityId", cityId);
            if (cityWardId) params.set("wardId", cityWardId);
          } else {
            if (upazilaId) params.set("upazilaId", upazilaId);
            if (unionId) params.set("unionId", unionId);
            if (ruralWardId) params.set("wardId", ruralWardId);
          }
        }

        const url = `/api/areas/by-admin?${params.toString()}`;
        const json = await fetchJSON(url, controller.signal);

        setData({
          items: json.items || [],
          total: json.total || 0,
          page: json.page || page,
          pageSize: json.pageSize || limit,
          pages: json.pages || 1,
          centersMatched: json.centersMatched ?? 0,
        });
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error(e);
          setErr(e.message || "Failed to load areas");
          setData({
            items: [],
            total: 0,
            page,
            pageSize: limit,
            pages: 1,
            centersMatched: 0,
          });
        }
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
    centerId,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
  ]);

  // --------------------
  // Sorting + paging helpers
  // --------------------
  function toggleSort(field) {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir(field === "totalVoters" ? "desc" : "asc");
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

  const pageWindow = useMemo(() => {
    const pages = data.pages || 1;
    const cur = page;
    const windowSize = 5;
    const start = Math.max(1, cur - Math.floor(windowSize / 2));
    const end = Math.min(pages, start + windowSize - 1);
    const fixedStart = Math.max(1, end - windowSize + 1);
    return Array.from(
      { length: end - fixedStart + 1 },
      (_, i) => fixedStart + i,
    );
  }, [data.pages, page]);

  const hasAnyFilter = useMemo(() => {
    if (centerId) return true;
    if (mode === "city") return !!(cityId || cityWardId);
    return !!(upazilaId || unionId || ruralWardId);
  }, [centerId, mode, cityId, cityWardId, upazilaId, unionId, ruralWardId]);

  function clearFilters() {
    setCenterId("");
    setCityId("");
    setCityWardId("");
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
    setQ("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Areas</h1>
        {canAdd && (
          <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => (window.location.href = "/areas/new")}
          >
            New Area
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="rounded border bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded border overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${
                mode === "city"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("city")}
              disabled={!!centerId}
              title={
                centerId ? "Clear Center ID filter to use admin filters" : ""
              }
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
              disabled={!!centerId}
              title={
                centerId ? "Clear Center ID filter to use admin filters" : ""
              }
            >
              Upazila
            </button>
          </div>

          {/* Optional direct centerId filter */}
          <input
            className="border rounded px-3 py-2 text-sm w-[240px]"
            placeholder="Center ID (optional)…"
            value={centerId}
            onChange={(e) => {
              setCenterId(e.target.value.trim());
              setPage(1);
            }}
          />

          <div className="ml-auto flex items-center gap-2">
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

            <button
              type="button"
              className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Admin dropdowns */}
        {!centerId && mode === "city" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Corporation
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value);
                  setCityWardId("");
                  setPage(1);
                }}
              >
                <option value="">— Select City Corporation —</option>
                {cityCorps.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Ward
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityWardId}
                onChange={(e) => {
                  setCityWardId(e.target.value);
                  setPage(1);
                }}
                disabled={!cityId}
              >
                <option value="">— Select City Ward —</option>
                {cityWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : !centerId ? (
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
                  setRuralWardId("");
                  setPage(1);
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

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Union
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={unionId}
                onChange={(e) => {
                  setUnionId(e.target.value);
                  setRuralWardId("");
                  setPage(1);
                }}
                disabled={!upazilaId}
              >
                <option value="">— Select Union —</option>
                {unions.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ward (Union)
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={ruralWardId}
                onChange={(e) => {
                  setRuralWardId(e.target.value);
                  setPage(1);
                }}
                disabled={!unionId}
              >
                <option value="">— Select Ward —</option>
                {ruralWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-600">
            Center ID filter is active — admin filters are disabled.
          </div>
        )}

        {/* Search */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm w-72"
            placeholder="Search (area name, code, center name)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="text-xs text-gray-600">
            {loading
              ? "Loading…"
              : hasAnyFilter
                ? `${data.total} areas • ${data.centersMatched} centers matched`
                : `Showing all areas (${data.total})`}
          </div>
        </div>

        {err && <div className="text-xs text-red-600">{err}</div>}
      </div>

      {/* Table */}
      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <Th sort={sort} dir={dir} field="name" onSort={toggleSort}>
                Name
              </Th>
              <th className="text-left p-2">Coordinates</th>
              <th className="text-left p-2">Center</th>
              <Th sort={sort} dir={dir} field="totalVoters" onSort={toggleSort}>
                Total
              </Th>
              <th className="text-left p-2">M/F</th>
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
                  No areas found.
                </td>
              </tr>
            )}

            {!loading &&
              data.items.map((a) => (
                <Row
                  key={a._id}
                  a={a}
                  canEdit={canEdit}
                  canDelete={canDelete}
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

function Row({ a, canEdit, canDelete }) {
  const onRowClick = () => {
    window.location.href = `/areas/${a._id}`;
  };

  const onEdit = (e) => {
    e.stopPropagation();
    if (!canEdit) return;
    window.location.href = `/areas/${a._id}/edit`;
  };

  const onDelete = async (e) => {
    e.stopPropagation();
    if (!canDelete) return;
    if (!confirm(`Delete area "${a.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/areas/${a._id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete");
      return;
    }
    window.location.reload();
  };

  const centerName =
    (a.center && (a.center.name || a.center)) || a.centerName || "—";

  const total = a.totalVoters ?? 0;
  const male = a.maleVoters ?? 0;
  const female = a.femaleVoters ?? 0;

  return (
    <tr
      className="border-t hover:bg-gray-50 cursor-pointer"
      onClick={onRowClick}
    >
      <td className="p-2 font-medium">{a.name}</td>
      <td className="p-2">{a.location ? "📍" : "—"}</td>
      <td className="p-2">{centerName}</td>
      <td className="p-2">{total}</td>
      <td className="p-2">
        {male} / {female}
      </td>
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
            <span className="text-xs text-gray-400">Open to view only</span>
          )}
        </div>
      </td>
    </tr>
  );
}
