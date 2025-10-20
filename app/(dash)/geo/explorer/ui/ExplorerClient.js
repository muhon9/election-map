// app/(dash)/geo/explorer/ui/ExplorerClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const TYPE_OPTIONS = [
  { key: "upazilla", label: "Upazillas" },
  { key: "city_corporation", label: "City Corporations" },
];

export default function ExplorerClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [type, setType] = useState(sp.get("type") || "city_corporation");
  const [parentId, setParentId] = useState(sp.get("parentId") || "");

  const [parents, setParents] = useState([]);
  const [children, setChildren] = useState([]);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);
  const [err, setErr] = useState("");

  // sync URL
  useEffect(() => {
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (parentId) qs.set("parentId", parentId);
    router.replace(`/geo/explorer?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, parentId]);

  // load left pane (parents)
  useEffect(() => {
    (async () => {
      try {
        setLoadingLeft(true);
        setErr("");
        const res = await fetch(
          `/api/geo?type=${encodeURIComponent(type)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load parents");
        setParents(j.items || []);
        // if current parentId not in list, clear
        if (parentId && !(j.items || []).find((p) => p._id === parentId)) {
          setParentId("");
        }
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingLeft(false);
      }
    })();
  }, [type]); // parentId cleared separately as needed

  // load right pane (children of selected parent)
  useEffect(() => {
    (async () => {
      try {
        if (!parentId) {
          setChildren([]);
          return;
        }
        setLoadingRight(true);
        setErr("");
        const res = await fetch(
          `/api/geo?parentId=${encodeURIComponent(parentId)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load children");
        setChildren(
          (j.items || []).sort(
            (a, b) =>
              (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
          )
        );
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingRight(false);
      }
    })();
  }, [parentId]);

  // create child quick form (right pane)
  const [newChildName, setNewChildName] = useState("");
  const [newChildType, setNewChildType] = useState("ward"); // common case
  const [savingChild, setSavingChild] = useState(false);

  async function createChild(e) {
    e.preventDefault();
    if (!parentId || !newChildName) return;
    setSavingChild(true);
    try {
      const res = await fetch(`/api/geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newChildType,
          name: newChildName,
          parentId,
          active: true,
          sort: children.length
            ? (children[children.length - 1].sort ?? 0) + 1
            : 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Create failed");
        return;
      }
      setNewChildName("");
      // reload
      const r = await fetch(
        `/api/geo?parentId=${encodeURIComponent(parentId)}&active=1`,
        { cache: "no-store" }
      );
      const jj = await r.json();
      setChildren(
        (jj.items || []).sort(
          (a, b) =>
            (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
        )
      );
    } finally {
      setSavingChild(false);
    }
  }

  // quick edit operations for child
  async function toggleActive(id, val) {
    const res = await fetch(`/api/geo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !!val }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Update failed");
      return;
    }
    // refresh
    const r = await fetch(
      `/api/geo?parentId=${encodeURIComponent(parentId)}&active=1`,
      { cache: "no-store" }
    );
    const jj = await r.json();
    setChildren(
      (jj.items || []).sort(
        (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
      )
    );
  }

  async function renameChild(id, name) {
    const res = await fetch(`/api/geo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Rename failed");
      return;
    }
    setChildren((prev) => prev.map((c) => (c._id === id ? { ...c, name } : c)));
  }

  async function updateSort(id, newSort) {
    const res = await fetch(`/api/geo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort: Number(newSort) || 0 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Sort update failed");
      return;
    }
    setChildren((prev) => {
      const next = prev.map((c) =>
        c._id === id ? { ...c, sort: Number(newSort) || 0 } : c
      );
      next.sort(
        (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
      );
      return next;
    });
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hierarchy Explorer</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/geo"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            List View
          </Link>
          <Link
            href="/geo/bulk"
            className="bg-gray-800 text-white px-3 py-1.5 rounded"
          >
            Bulk Upload
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded border bg-white p-3 text-sm text-red-600">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: Parents */}
        <section className="rounded border bg-white">
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Type:</span>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={type}
                onChange={(e) => {
                  setParentId("");
                  setType(e.target.value);
                }}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto divide-y">
            {loadingLeft ? (
              <div className="p-3 text-sm text-gray-600">Loading…</div>
            ) : parents.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No {type} yet.</div>
            ) : (
              parents.map((p) => {
                const active = p.active !== false;
                const selected = p._id === parentId;
                return (
                  <button
                    key={p._id}
                    className={`w-full text-left p-3 hover:bg-gray-50 ${
                      selected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setParentId(p._id)}
                    title={active ? "" : "Inactive"}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{p.name}</div>
                      {!active && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {p.code ? (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Code: {p.code}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT: Children */}
        <section className="rounded border bg-white">
          <div className="border-b p-3">
            <div className="text-sm text-gray-600">
              {parentId
                ? "Children of selected parent"
                : "Select a parent to view children"}
            </div>
          </div>

          {!parentId ? (
            <div className="p-6 text-sm text-gray-500">
              Pick a parent on the left.
            </div>
          ) : (
            <>
              <form
                onSubmit={createChild}
                className="p-3 flex flex-wrap items-end gap-2 border-b"
              >
                <div className="grid">
                  <label className="text-xs text-gray-600">Child type</label>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={newChildType}
                    onChange={(e) => setNewChildType(e.target.value)}
                  >
                    <option value="ward">ward</option>
                    <option value="union">union</option>
                  </select>
                </div>
                <div className="grid flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-600">Child name</label>
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="e.g., Ward-01"
                    required
                  />
                </div>
                <button
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                  disabled={savingChild}
                >
                  {savingChild ? "Adding…" : "Add Child"}
                </button>
              </form>

              <div className="max-h-[66vh] overflow-auto divide-y">
                {loadingRight ? (
                  <div className="p-3 text-sm text-gray-600">Loading…</div>
                ) : children.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">
                    No children yet.
                  </div>
                ) : (
                  children.map((c) => (
                    <ChildRow
                      key={c._id}
                      item={c}
                      onToggle={(v) => toggleActive(c._id, v)}
                      onRename={(name) => renameChild(c._id, name)}
                      onSort={(n) => updateSort(c._id, n)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChildRow({ item, onToggle, onRename, onSort }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name || "");
  const [sort, setSort] = useState(String(item.sort ?? 0));
  const active = item.active !== false;

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <input
              className="border rounded px-2 py-1 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="px-2 py-1 border rounded text-sm"
              onClick={async () => {
                if (!name.trim()) return;
                await onRename(name.trim());
                setEditing(false);
              }}
            >
              Save
            </button>
            <button
              className="px-2 py-1 border rounded text-sm"
              onClick={() => {
                setName(item.name || "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="font-medium">{item.name}</div>
            <button
              className="text-blue-600 underline text-sm"
              onClick={() => setEditing(true)}
            >
              Rename
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onToggle(e.target.checked)}
            />
            Active
          </label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500">Sort</span>
            <input
              className="border rounded px-2 py-1 w-20 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              onBlur={() => onSort(sort)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSort(sort);
              }}
              inputMode="numeric"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
