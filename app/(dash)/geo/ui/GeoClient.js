// app/(dash)/geo/ui/GeoClient.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TYPES = ["upazilla", "city_corporation", "union", "ward"];

export default function GeoClient() {
  const [type, setType] = useState("upazilla");
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState([]);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [eName, setEName] = useState("");
  const [eCode, setECode] = useState("");
  const [eSort, setESort] = useState("0");
  const [eActive, setEActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  async function loadParents() {
    const res = await fetch(`/api/geo?active=1`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load parents");
    setParents(j.items || []);
  }

  async function loadList() {
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (parentId) sp.set("parentId", parentId);
    if (q) sp.set("q", q);
    sp.set("active", "1");
    const res = await fetch(`/api/geo?${sp.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load");
    setItems((j.items || []).sort(sorter));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        await loadParents();
        await loadList();
      } catch (e) {
        setErr(e?.message || "Failed");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, parentId, q]);

  function openEdit(row) {
    setEditRow(row);
    setEName(row.name || "");
    setECode(row.code || "");
    setESort(String(row.sort ?? 0));
    setEActive(row.active !== false);
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/geo/${editRow._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eName.trim(),
          code: eCode.trim(),
          sort: Number(eSort) || 0,
          active: !!eActive,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Update failed");
        return;
      }
      setEditOpen(false);
      setEditRow(null);
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/geo/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Delete failed");
        return;
      }
      await loadList();
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Location Manager (List)</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/geo/kanban"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            Kanban
          </Link>
          <Link
            href="/geo/explorer"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            Explorer
          </Link>
          <Link
            href="/geo/explorer3"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            3-pane
          </Link>
          <Link
            href="/geo/bulk"
            className="bg-gray-800 text-white px-3 py-1.5 rounded"
          >
            Bulk Upload
          </Link>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded border bg-white p-4">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setParentId("");
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="name / code"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Parent
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">All parents</option>
              {parents
                .filter((p) => p.active !== false)
                .sort(sorter)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.type}: {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      ) : err ? (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      ) : (
        <div className="rounded border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Type</Th>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Parent</Th>
                <Th>Sort</Th>
                <Th>Active</Th>
                <Th className="w-40">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No items
                  </td>
                </tr>
              ) : (
                items.map((x) => (
                  <tr key={x._id} className="border-t">
                    <Td>{x.type}</Td>
                    <Td className="font-medium">{x.name}</Td>
                    <Td>{x.code || "—"}</Td>
                    <Td>{x.parent ? String(x.parent?.name) : "—"}</Td>
                    <Td>{x.sort ?? 0}</Td>
                    <Td>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          x.active !== false
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {x.active !== false ? "Active" : "Inactive"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded border hover:bg-gray-50"
                          onClick={() => openEdit(x)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1.5 rounded border text-red-700 hover:bg-red-50"
                          onClick={() => onDelete(x._id)}
                          disabled={deletingId === x._id}
                        >
                          {deletingId === x._id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">Edit: {editRow?.name}</div>
              <button
                className="px-2 py-1 border rounded hover:bg-gray-50 text-sm"
                onClick={() => setEditOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    className="border rounded w-full px-3 py-2"
                    value={eName}
                    onChange={(e) => setEName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Code (optional)
                  </label>
                  <input
                    className="border rounded w-full px-3 py-2"
                    value={eCode}
                    onChange={(e) => setECode(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Sort
                  </label>
                  <input
                    className="border rounded w-full px-3 py-2"
                    value={eSort}
                    onChange={(e) => setESort(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <label className="flex items-center gap-2 mt-6 md:mt-6">
                  <input
                    type="checkbox"
                    checked={eActive}
                    onChange={(e) => setEActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left p-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`p-2 ${className}`}>{children}</td>;
}

function sorter(a, b) {
  const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0;
  const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0;
  return sa - sb || String(a.name).localeCompare(String(b.name));
}
