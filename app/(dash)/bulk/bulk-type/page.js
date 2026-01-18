"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { cache: "no-store", ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export default function CommitteesBulkTypePage() {
  const { data: session } = useSession();
  const user = session?.user;

  const canView = has(user, "view_committees") || has(user, "view_centers");
  const canManage = has(user, "manage_committees") || has(user, "manage_roles");

  // list state
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("city"); // city | rural
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState("desc");

  // geo filters
  const [cityId, setCityId] = useState("");
  const [cityWardId, setCityWardId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [ruralWardId, setRuralWardId] = useState("");

  // type filters
  const [typeIdFilter, setTypeIdFilter] = useState(""); // optional
  const [hasType, setHasType] = useState(""); // "", "1", "0"

  // data
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // geo dropdown lists
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  // committee types dropdown
  const [types, setTypes] = useState([]);

  // selection
  const [selected, setSelected] = useState({}); // { [id]: true }
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );
  const allOnPageIds = useMemo(
    () => (data.items || []).map((x) => String(x._id)),
    [data.items],
  );
  const allOnPageSelected = useMemo(() => {
    if (!allOnPageIds.length) return false;
    return allOnPageIds.every((id) => selected[id]);
  }, [allOnPageIds, selected]);

  // target bulk type
  const [targetTypeId, setTargetTypeId] = useState("");
  const [saving, setSaving] = useState(false);

  // ----------------------------
  // Load geo lists + types
  // ----------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cc, upa, t] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
          fetchJSON(
            "/api/committee-types?active=1&sort=sort&dir=asc&limit=200",
          ),
        ]);
        if (!alive) return;
        setCityCorps(cc.items || []);
        setUpazilas(upa.items || []);
        setTypes(t.items || []);
      } catch (e) {
        console.error(e);
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
      setCityWardId("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
        if (!alive) return;
        setCityWards(j.items || []);
      } catch (e) {}
    })();
    return () => {
      alive = false;
    };
  }, [cityId]);

  // Upazila -> unions
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
      } catch (e) {}
    })();
    return () => {
      alive = false;
    };
  }, [upazilaId]);

  // Union -> rural wards
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
      } catch (e) {}
    })();
    return () => {
      alive = false;
    };
  }, [unionId]);

  // ----------------------------
  // Load committees list
  // ----------------------------
  useEffect(() => {
    if (!canView) return;

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
        if (q.trim()) params.set("q", q.trim());

        params.set("mode", mode);

        // admin filters
        if (mode === "city") {
          if (cityId) params.set("cityId", cityId);
          if (cityWardId) params.set("wardId", cityWardId);
        } else {
          if (upazilaId) params.set("upazilaId", upazilaId);
          if (unionId) params.set("unionId", unionId);
          if (ruralWardId) params.set("wardId", ruralWardId);
        }

        // type filters
        if (typeIdFilter) params.set("typeId", typeIdFilter);
        if (hasType !== "") params.set("hasType", hasType);

        const j = await fetchJSON(
          `/api/committees/bulk-type?${params.toString()}`,
          { signal: controller.signal },
        );

        setData({
          items: j.items || [],
          total: j.total || 0,
          page: j.page || page,
          pageSize: j.pageSize || limit,
          pages: j.pages || 1,
        });

        // If the current page changed due to filters, also reset selection-on-page if needed
      } catch (e) {
        if (e.name !== "AbortError") setErr(e.message || "Failed to load");
        setData({ items: [], total: 0, page, pageSize: limit, pages: 1 });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    canView,
    q,
    page,
    limit,
    sort,
    dir,
    mode,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
    typeIdFilter,
    hasType,
  ]);

  function chooseMode(next) {
    setMode(next);
    setPage(1);
    // clear opposite chain
    if (next === "city") {
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      setCityId("");
      setCityWardId("");
    }
  }

  function toggleSort(field) {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir(field === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  function gotoPage(p) {
    const target = Math.max(1, Math.min(data.pages || 1, p));
    setPage(target);
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

  function toggleOne(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function togglePageAll() {
    setSelected((prev) => {
      const next = { ...prev };
      const want = !allOnPageSelected;
      for (const id of allOnPageIds) next[id] = want;
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  async function applyBulk() {
    if (!canManage) return;
    if (!selectedIds.length) {
      alert("Select at least one committee.");
      return;
    }

    // allow clearing type by choosing empty
    const confirmMsg = targetTypeId
      ? `Apply selected committee type to ${selectedIds.length} committees?`
      : `Clear committee type for ${selectedIds.length} committees?`;

    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      await fetchJSON("/api/committees/bulk-type", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          typeId: targetTypeId ? targetTypeId : null,
        }),
      });

      clearSelection();
      // refresh list
      setPage(1);
      // or just reload current page:
      // (force refetch by updating page state to same value)
      // easiest:
      await new Promise((r) => setTimeout(r, 50));
      // trigger fetch by small change
      setPage((p) => p);
      alert("Updated successfully");
    } catch (e) {
      alert(e.message || "Bulk update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        You don’t have permission to view committees.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bulk Change Committee Type</h1>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-600">
            Selected:{" "}
            <span className="font-semibold">{selectedIds.length}</span>
          </div>
          <button
            type="button"
            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
            onClick={clearSelection}
            disabled={!selectedIds.length}
          >
            Clear selection
          </button>
        </div>
      </div>

      {/* Filters */}
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

          <input
            className="border rounded px-3 py-2 text-sm w-72"
            placeholder="Search committee (name/notes/ocr)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="border rounded px-2 py-2 text-sm"
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <select
              className="border rounded px-2 py-2 text-sm"
              value={hasType}
              onChange={(e) => {
                setHasType(e.target.value);
                setTypeIdFilter("");
                setPage(1);
              }}
              title="Type presence filter"
            >
              <option value="">All</option>
              <option value="1">Has type</option>
              <option value="0">No type</option>
            </select>

            <select
              className="border rounded px-2 py-2 text-sm"
              value={typeIdFilter}
              onChange={(e) => {
                setTypeIdFilter(e.target.value);
                setHasType("");
                setPage(1);
              }}
              title="Filter by a specific type"
            >
              <option value="">Filter by type…</option>
              {types.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Geo filters */}
        {mode === "city" ? (
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
        ) : (
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
        )}

        {err && (
          <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {err}
          </div>
        )}

        <div className="text-xs text-gray-600">
          {loading ? "Loading…" : `${data.total} committees`}
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="rounded border bg-white p-3 flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-3 py-2 text-sm"
          value={targetTypeId}
          onChange={(e) => setTargetTypeId(e.target.value)}
          disabled={!canManage || saving}
          title="Choose a committee type"
        >
          <option value="">— Clear Type (set empty) —</option>
          {types.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>

        <button
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          onClick={applyBulk}
          disabled={!canManage || saving || selectedIds.length === 0}
        >
          {saving ? "Applying…" : "Apply to selected"}
        </button>

        <div className="ml-auto text-xs text-gray-600">
          Tip: use “Select page” checkbox then apply.
        </div>
      </div>

      {/* Table */}
      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 w-[44px]">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePageAll}
                  title="Select all on this page"
                />
              </th>
              <Th sort={sort} dir={dir} field="name" onSort={toggleSort}>
                Committee
              </Th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Geo</th>
              <Th sort={sort} dir={dir} field="createdAt" onSort={toggleSort}>
                Created
              </Th>
              <th className="text-left p-2 w-[130px]">Open</th>
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

            {!loading && (data.items || []).length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  No committees found.
                </td>
              </tr>
            )}

            {!loading &&
              (data.items || []).map((c) => (
                <tr key={c._id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={!!selected[String(c._id)]}
                      onChange={() => toggleOne(String(c._id))}
                    />
                  </td>
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">
                    <span className="font-mono text-xs">
                      {c.typeKey || "—"}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-gray-700">
                    {formatGeo(c.geo)}
                  </td>
                  <td className="p-2 text-xs text-gray-700">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-2">
                    <a
                      className="px-2 py-1 text-blue-700 border border-blue-200 rounded hover:bg-blue-50 inline-flex"
                      href={`/committees/${c._id}`}
                    >
                      Open
                    </a>
                  </td>
                </tr>
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

function formatGeo(geo) {
  const parts = [];
  if (geo?.city?.name) parts.push(`City: ${geo.city.name}`);
  if (geo?.ward?.name) parts.push(`Ward: ${geo.ward.name}`);
  if (geo?.upazila?.name) parts.push(`Upazila: ${geo.upazila.name}`);
  if (geo?.union?.name) parts.push(`Union: ${geo.union.name}`);
  return parts.length ? parts.join(" • ") : "—";
}
