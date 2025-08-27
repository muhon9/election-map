"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function usePerms() {
  const { data } = useSession();
  const perms = data?.user?.permissions || data?.permissions || []; // adjust if your session shape differs
  const has = (p) => perms?.includes?.(p);
  return { perms, has };
}

export default function CentersPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { has } = usePerms();

  // read initial state from URL
  const initPage = parseInt(sp.get("page") || "1", 10);
  const initLimit = parseInt(sp.get("limit") || "10", 10);
  const initQ = sp.get("q") || "";
  const initSort = sp.get("sort") || "createdAt";
  const initDir = sp.get("dir") || "desc";

  const [page, setPage] = useState(initPage);
  const [limit, setLimit] = useState(initLimit);
  const [q, setQ] = useState(initQ);
  const [sort, setSort] = useState(initSort);
  const [dir, setDir] = useState(initDir);
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: limit,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // keep URL in sync (so refresh/back works)
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (limit !== 10) params.set("limit", String(limit));
    if (q) params.set("q", q);
    if (sort !== "createdAt") params.set("sort", sort);
    if (dir !== "desc") params.set("dir", dir);
    const qs = params.toString();
    router.replace(qs ? `/centers?${qs}` : `/centers`);
  }, [page, limit, q, sort, dir, router]);

  // fetch data when state changes (debounce q)
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `/api/centers?page=${page}&limit=${limit}&q=${encodeURIComponent(
          q
        )}&sort=${sort}&dir=${dir}`;
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
    }, 350); // debounce search a bit

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, limit, q, sort, dir]);

  function toggleSort(field) {
    if (sort === field) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDir("asc"); // default asc when new field
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

  // simple page numbers (1..N up to a window)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Centers</h1>

        <div className="flex items-center gap-2">
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
      </div>

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
                <td className="p-3 text-gray-500" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && data.items.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={7}>
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
  // row click navigates; action buttons stop propagation
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
    // After delete, refresh the page list without a full reload:
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
