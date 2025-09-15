// app/roles/page.js
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import Link from "next/link";

export default function RolesPage() {
  const { data } = useSession();
  const user = data?.user;
  const canManage = has(user, "manage_roles");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [list, setList] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);

  // quick create
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canManage) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/roles?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!alive) return;
        setList(j || { items: [], total: 0, page: 1, pages: 1 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, page, limit, canManage]);

  async function onCreate(e) {
    e.preventDefault();
    setCreateErr("");
    if (!name.trim()) return setCreateErr("Role name is required");
    setCreating(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), permissions: [] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateErr(j?.error || "Failed to create role");
        return;
      }
      setName("");
      // refresh
      setPage(1);
      setQ("");
    } finally {
      setCreating(false);
    }
  }

  if (!canManage) {
    return (
      <div className="p-4 text-sm text-gray-600">
        You don’t have permission to manage roles.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Roles</h1>
      </header>

      {/* Quick create */}
      <form
        onSubmit={onCreate}
        className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Role name
          </label>
          <input
            className="border rounded w-full px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Supervisor"
          />
          {createErr && (
            <p className="text-sm text-red-600 mt-1">{createErr}</p>
          )}
        </div>
        <div className="flex items-end">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create role"}
          </button>
        </div>
      </form>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">{list.total} total</div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Search roles…"
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
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Permissions</th>
              <th className="text-left p-2 w-[140px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={3}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && list.items.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={3}>
                  No roles.
                </td>
              </tr>
            )}
            {!loading &&
              list.items.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2">
                    {Array.isArray(r.permissions) && r.permissions.length ? (
                      <div className="flex flex-wrap gap-1">
                        {r.permissions.map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded bg-gray-100 border text-xs"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Link
                      href={`/roles/${r._id}`}
                      className="text-blue-600 underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page <b>{list.page || 1}</b> of <b>{list.pages || 1}</b>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={(list.page || 1) <= 1}
          >
            Prev
          </button>
          {Array.from({ length: list.pages || 1 }, (_, i) => i + 1)
            .slice(Math.max(0, (list.page || 1) - 3), (list.page || 1) + 2)
            .map((n) => (
              <button
                key={n}
                className={`px-3 py-1.5 border rounded text-sm ${
                  n === (list.page || 1)
                    ? "bg-blue-600 text-white border-blue-600"
                    : ""
                }`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(list.pages || 1, p + 1))}
            disabled={(list.page || 1) >= (list.pages || 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
