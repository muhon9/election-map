"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

export default function AreaList({ centerId }) {
  const { data: session } = useSession();
  const user = session?.user;

  const canView = has(user, "view_centers");
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState("desc");

  const [data, setData] = useState({
    items: [],
    total: 0,
    pages: 1,
    page: 1,
    pageSize: limit,
  });
  const [loading, setLoading] = useState(false);

  // form state for create/edit
  const [form, setForm] = useState({
    name: "",
    code: "",
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState(null);
  const isEditing = !!editingId;

  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    setLoading(true);
    const url = `/api/centers/${centerId}/areas?q=${encodeURIComponent(
      q
    )}&page=${page}&limit=${limit}&sort=${sort}&dir=${dir}`;
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => {
        if (e.name !== "AbortError") console.error(e);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [centerId, q, page, limit, sort, dir, canView]);

  function resetForm() {
    setForm({
      name: "",
      code: "",
      totalVoters: "",
      maleVoters: "",
      femaleVoters: "",
      notes: "",
    });
    setEditingId(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      name: form.name?.trim(),
      code: form.code?.trim(),
      totalVoters: Number(form.totalVoters || 0),
      maleVoters: Number(form.maleVoters || 0),
      femaleVoters: Number(form.femaleVoters || 0),
      notes: form.notes?.trim() || "",
    };

    if (!isEditing) {
      const res = await fetch(`/api/centers/${centerId}/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to create area");
        return;
      }
    } else {
      const res = await fetch(`/api/areas/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to update area");
        return;
      }
    }

    resetForm();
    // refresh list
    const url = `/api/centers/${centerId}/areas?q=${encodeURIComponent(
      q
    )}&page=${page}&limit=${limit}&sort=${sort}&dir=${dir}`;
    const j = await (await fetch(url, { cache: "no-store" })).json();
    setData(j);
  }

  function onEdit(a) {
    setEditingId(a._id);
    setForm({
      name: a.name || "",
      code: a.code || "",
      totalVoters: a.totalVoters ?? "",
      maleVoters: a.maleVoters ?? "",
      femaleVoters: a.femaleVoters ?? "",
      notes: a.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id) {
    if (!canDelete) return;
    if (!confirm("Delete this area? This cannot be undone.")) return;
    const res = await fetch(`/api/areas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete area");
      return;
    }
    // refetch
    const url = `/api/centers/${centerId}/areas?q=${encodeURIComponent(
      q
    )}&page=${page}&limit=${limit}&sort=${sort}&dir=${dir}`;
    const j = await (await fetch(url, { cache: "no-store" })).json();
    setData(j);
  }

  function toggleSort(field) {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir("asc");
    }
  }

  const pageNumbers = useMemo(() => {
    const pages = data.pages || 1;
    const cur = data.page || 1;
    const windowSize = 5;
    const start = Math.max(1, cur - Math.floor(windowSize / 2));
    const end = Math.min(pages, start + windowSize - 1);
    const s = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - s + 1 }, (_, i) => s + i);
  }, [data.pages, data.page]);

  if (!canView) {
    return (
      <div className="p-4 text-sm text-gray-600">
        You don’t have permission to view areas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create / Edit form */}
      {canEdit && (
        <form
          onSubmit={onSubmit}
          className="p-4 border rounded bg-white grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Area name
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Code (optional)
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Total voters
            </label>
            <input
              type="number"
              min="0"
              className="border rounded w-full px-3 py-2"
              value={form.totalVoters}
              onChange={(e) =>
                setForm((f) => ({ ...f, totalVoters: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Male voters
            </label>
            <input
              type="number"
              min="0"
              className="border rounded w-full px-3 py-2"
              value={form.maleVoters}
              onChange={(e) =>
                setForm((f) => ({ ...f, maleVoters: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Female voters
            </label>
            <input
              type="number"
              min="0"
              className="border rounded w-full px-3 py-2"
              value={form.femaleVoters}
              onChange={(e) =>
                setForm((f) => ({ ...f, femaleVoters: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              className="border rounded w-full px-3 py-2"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
              {isEditing ? "Update Area" : "Add Area"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 rounded border"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Areas</div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Search areas…"
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
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border overflow-x-auto bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <Th field="name" sort={sort} dir={dir} onSort={toggleSort}>
                Name
              </Th>
              <Th field="code" sort={sort} dir={dir} onSort={toggleSort}>
                Code
              </Th>
              <th className="text-left p-2">Total</th>
              <th className="text-left p-2">M/F</th>
              <Th field="createdAt" sort={sort} dir={dir} onSort={toggleSort}>
                Created
              </Th>
              <th className="text-left p-2 w-[180px]">Actions</th>
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
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className="p-2">{a.code || "—"}</td>
                  <td className="p-2">{a.totalVoters ?? 0}</td>
                  <td className="p-2">
                    {a.maleVoters ?? 0} / {a.femaleVoters ?? 0}
                  </td>
                  <td className="p-2">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <a
                        className="px-2 py-1 border rounded hover:bg-gray-50"
                        href={`/areas/${a._id}`}
                      >
                        Open
                      </a>
                      {canEdit && (
                        <button
                          className="px-2 py-1 text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                          onClick={() => onEdit(a)}
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                          onClick={() => onDelete(a._id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page <b>{data.page}</b> of <b>{data.pages}</b> • <b>{data.total}</b>{" "}
          total
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              className={`px-3 py-1.5 border rounded text-sm ${
                n === page ? "bg-blue-600 text-white border-blue-600" : ""
              }`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(data.pages || 1, p + 1))}
            disabled={page >= (data.pages || 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, field, sort, dir, onSort }) {
  const active = sort === field;
  return (
    <th className="text-left p-2 select-none">
      <span
        role="button"
        className="inline-flex items-center gap-1 cursor-pointer"
        onClick={() => onSort(field)}
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}
