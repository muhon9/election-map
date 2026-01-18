"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { cache: "no-store", ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export default function CommitteeTypesPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const canManage = has(user, "manage_committees") || has(user, "manage_roles"); // adjust if needed

  const [q, setQ] = useState("");
  const [active, setActive] = useState("1"); // "1" | "0" | ""
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // editor modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // type doc or null
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    color: "",
    sort: 0,
    active: true,
  });

  function setF(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (active !== "") params.set("active", active);
      params.set("sort", "sort");
      params.set("dir", "asc");
      params.set("limit", "200");

      const j = await fetchJSON(`/api/committee-types?${params.toString()}`);
      setItems(j.items || []);
    } catch (e) {
      setErr(e.message || "Failed to load committee types");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, active]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      key: "",
      description: "",
      color: "",
      sort: 0,
      active: true,
    });
    setOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item?.name || "",
      key: item?.key || "",
      description: item?.description || "",
      color: item?.color || "",
      sort: Number(item?.sort || 0),
      active: item?.active !== false,
    });
    setOpen(true);
  }

  async function onSave(e) {
    e?.preventDefault?.();
    if (!canManage) return;

    const payload = {
      name: (form.name || "").trim(),
      key: (form.key || "").trim(),
      description: (form.description || "").trim(),
      color: (form.color || "").trim(),
      sort: Number(form.sort || 0),
      active: !!form.active,
    };

    if (!payload.name) {
      alert("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (!editing?._id) {
        await fetchJSON(`/api/committee-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJSON(`/api/committee-types/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item) {
    if (!canManage) return;
    if (!item?._id) return;

    const ok = confirm(
      `Delete committee type "${item.name}"?\n\nIf it's used by any committees, delete will be blocked.`,
    );
    if (!ok) return;

    try {
      await fetchJSON(`/api/committee-types/${item._id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  async function toggleActive(item) {
    if (!canManage) return;
    try {
      await fetchJSON(`/api/committee-types/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      await load();
    } catch (e) {
      alert(e.message || "Update failed");
    }
  }

  const visible = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Committee Types</h1>
        {canManage && (
          <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={openCreate}
          >
            New Type
          </button>
        )}
      </div>

      <div className="rounded border bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm w-72"
            placeholder="Search (name/key)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded px-2 py-2 text-sm"
            value={active}
            onChange={(e) => setActive(e.target.value)}
            title="Active filter"
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
            <option value="">All</option>
          </select>

          <div className="ml-auto text-xs text-gray-600">
            {loading ? "Loading…" : `${visible.length} types`}
          </div>
        </div>

        {err && (
          <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {err}
          </div>
        )}
      </div>

      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Key</th>
              <th className="text-left p-2">Description</th>
              <th className="text-left p-2">Sort</th>
              <th className="text-left p-2">Active</th>
              <th className="text-left p-2 w-[220px]">Actions</th>
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

            {!loading && visible.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  No committee types found.
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((t) => (
                <tr key={t._id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{t.name}</td>
                  <td className="p-2 font-mono text-xs">{t.key}</td>
                  <td className="p-2 text-gray-700">{t.description || "—"}</td>
                  <td className="p-2">{t.sort ?? 0}</td>
                  <td className="p-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                        t.active
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage ? (
                        <>
                          <button
                            className="px-2 py-1 text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                            onClick={() => openEdit(t)}
                          >
                            Edit
                          </button>
                          <button
                            className="px-2 py-1 text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                            onClick={() => toggleActive(t)}
                          >
                            {t.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                            onClick={() => onDelete(t)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">
                          No permission
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setOpen(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <form
              onSubmit={onSave}
              className="w-full max-w-xl rounded-lg bg-white shadow-lg border"
            >
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold">
                  {editing ? "Edit Type" : "New Type"}
                </div>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-800"
                  onClick={() => !saving && setOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      className="border rounded w-full px-3 py-2"
                      value={form.name}
                      onChange={(e) => setF("name", e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Key (optional)
                    </label>
                    <input
                      className="border rounded w-full px-3 py-2 font-mono text-sm"
                      value={form.key}
                      onChange={(e) => setF("key", e.target.value)}
                      placeholder='Example: "RENOWNED"'
                      disabled={!canManage}
                    />
                    <div className="text-[11px] text-gray-500 mt-1">
                      If empty, it will be generated from name. Changing key
                      will migrate committees automatically (per your API).
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="border rounded w-full px-3 py-2"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setF("description", e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Sort
                    </label>
                    <input
                      type="number"
                      className="border rounded w-full px-3 py-2"
                      value={form.sort}
                      onChange={(e) => setF("sort", e.target.value)}
                      disabled={!canManage}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Color (optional)
                    </label>
                    <input
                      className="border rounded w-full px-3 py-2"
                      value={form.color}
                      onChange={(e) => setF("color", e.target.value)}
                      placeholder="#16a34a"
                      disabled={!canManage}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!form.active}
                        onChange={(e) => setF("active", e.target.checked)}
                        disabled={!canManage}
                      />
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 border rounded hover:bg-gray-50"
                  onClick={() => !saving && setOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={!canManage || saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
