"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

function qs(obj) {
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return sp.toString();
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AgentGroupsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const canView = true;
  const canAdd = has(user, "add_center"); // reuse for now
  const canDelete = has(user, "delete_center"); // reuse for now

  // ---------- filters ----------
  const [mode, setMode] = useState("city"); // "city" | "rural"
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // City path
  const [cityCorps, setCityCorps] = useState([]);
  const [cityId, setCityId] = useState("");
  const [cityWards, setCityWards] = useState([]);
  const [cityWardId, setCityWardId] = useState("");

  // Rural path
  const [upazilas, setUpazilas] = useState([]);
  const [upazilaId, setUpazilaId] = useState("");
  const [unions, setUnions] = useState([]);
  const [unionId, setUnionId] = useState("");
  const [ruralWards, setRuralWards] = useState([]);
  const [ruralWardId, setRuralWardId] = useState("");

  // ---------- data ----------
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // load top-level geos once
  useEffect(() => {
    (async () => {
      try {
        const [cc, upa] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        setCityCorps(cc.items || []);
        setUpazilas(upa.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // city changed → load wards; clear rural
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      setCityWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
        setCityWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    setMode("city");
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
  }, [cityId]);

  // upazila changed → load unions; clear city
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      setUnionId("");
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`);
        setUnions(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    setMode("rural");
    setCityId("");
    setCityWardId("");
  }, [upazilaId]);

  // union changed → load rural wards
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${unionId}&active=1`);
        setRuralWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [unionId]);

  // build query for /api/agent-groups
  const queryString = useMemo(() => {
    const base = { page, limit, q };

    // Important: filter is by center-admin (derived from center)
    if (mode === "city") {
      base.mode = "city";
      base.cityId = cityId || undefined;
      base.wardId = cityWardId || undefined;
    } else {
      base.mode = "rural";
      base.upazilaId = upazilaId || undefined;
      base.unionId = unionId || undefined;
      base.wardId = ruralWardId || undefined;
    }

    return qs(base);
  }, [
    mode,
    page,
    limit,
    q,
    cityId,
    cityWardId,
    upazilaId,
    unionId,
    ruralWardId,
  ]);

  // fetch list
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const j = await fetchJSON(`/api/agent-groups?${queryString}`);
        setRows(j.items || []);
        setTotal(j.total || 0);
      } catch (e) {
        setErr(() => {
          try {
            const obj = JSON.parse(e.message);
            return obj?.error || "Failed to load agent groups";
          } catch {
            return "Failed to load agent groups";
          }
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [queryString]);

  // reset page when filters change (except page)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, q, cityId, cityWardId, upazilaId, unionId, ruralWardId, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function clearFilters() {
    setQ("");
    setMode("city");
    setCityId("");
    setCityWardId("");
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
  }

  async function handleDelete(id) {
    if (!canDelete) return;
    if (!window.confirm("Delete this agent group? This cannot be undone."))
      return;

    try {
      const res = await fetch(`/api/agent-groups/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to delete agent group");
      }
      setRows((prev) => prev.filter((r) => r._id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Failed to delete agent group");
    }
  }

  if (!canView) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        You don’t have permission to view agent groups.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent Groups</h1>
        <div className="flex items-center gap-2">
          {canAdd && (
            <Link
              href="/agent-groups/new"
              className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
            >
              New Agent Group
            </Link>
          )}
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search (group name / center name)
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., আলিয়া মাদ্রাসা পুরুষ কেন্দ্র"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "city" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => setMode("city")}
              title="City Corporation → City Ward"
            >
              City
            </button>
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "rural" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => setMode("rural")}
              title="Upazila → Union → Ward"
            >
              Upazila
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <label className="text-xs text-gray-600">Per page</label>
            <select
              className="border rounded px-2 py-1"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Geo filters */}
        {mode === "city" ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Corporation
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">— Any —</option>
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
                onChange={(e) => setCityWardId(e.target.value)}
                disabled={!cityId}
              >
                <option value="">— Any —</option>
                {cityWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upazila
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={upazilaId}
                onChange={(e) => setUpazilaId(e.target.value)}
              >
                <option value="">— Any —</option>
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
                onChange={(e) => setUnionId(e.target.value)}
                disabled={!upazilaId}
              >
                <option value="">— Any —</option>
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
                onChange={(e) => setRuralWardId(e.target.value)}
                disabled={!unionId}
              >
                <option value="">— Any —</option>
                {ruralWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Center</th>
              <th className="text-left p-2"> Details</th>
              <th className="text-left p-2">People</th>
              <th className="text-right p-2 w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500">
                  No agent groups found.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => (
                <tr key={r._id} className="border-t hover:bg-gray-50">
                  {/* <td className="p-2">
                    <Link
                      href={`/centers/${r.center._id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.center.name}
                    </Link>
                  </td> */}
                  <td className="p-2">{r.center.name}</td>
                  <td className="p-2 font-medium">
                    <Link
                      href={`/agent-groups/${r._id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>

                  <td className="p-2">{r.peopleCount || "—"}</td>
                  <td className="p-2 text-right space-x-2">
                    <Link
                      href={`/agent-groups/${r._id}`}
                      className="px-2 py-1 border rounded hover:bg-gray-50"
                    >
                      Open
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        className="px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(r._id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {(rows.length && (page - 1) * limit + 1) || 0}–
          {(page - 1) * limit + rows.length} of {total}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <span className="text-sm">
            Page {page} / {totalPages}
          </span>

          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
