// app/roles/[id]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import { PERMISSIONS, groupPermissions } from "@/lib/permDefs";

export default function RoleEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;
  const canManage = has(user, "manage_roles");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [role, setRole] = useState(null);

  const [name, setName] = useState("");
  const [perms, setPerms] = useState([]); // strings
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => groupPermissions(PERMISSIONS), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canManage) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/roles/${id}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load role");
        setRole(j);
        setName(j.name || "");
        setPerms(Array.isArray(j.permissions) ? j.permissions : []);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load role");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, canManage]);

  function togglePerm(key) {
    setPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function onSave(e) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), permissions: perms }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to update role");
        return;
      }
      setRole(j);
      alert("Role updated.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!canManage) return;
    if (!confirm("Delete this role? This cannot be undone.")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete role");
      return;
    }
    router.push("/roles");
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
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={() => router.back()}
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <h1 className="text-xl font-semibold">
        {role ? `Edit Role: ${role.name}` : "Edit Role"}
      </h1>

      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {!loading && !err && role && (
        <form onSubmit={onSave} className="space-y-6">
          <section className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Role name
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </section>

          <section className="rounded border bg-white p-4">
            <h2 className="text-base font-semibold mb-3">Permissions</h2>

            <div className="space-y-5">
              {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <div className="font-medium mb-2">{group}</div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 border rounded px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={perms.includes(p.key)}
                          onChange={() => togglePerm(p.key)}
                        />
                        <span>{p.label}</span>
                        <code className="ml-auto text-xs text-gray-500">
                          {p.key}
                        </code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-2">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="px-3 py-2 border rounded hover:bg-gray-50"
              onClick={() => router.push("/roles")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
