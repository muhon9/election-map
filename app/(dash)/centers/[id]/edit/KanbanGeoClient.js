// app/(dash)/geo/kanban/ui/KanbanGeoClient.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function KanbanGeoClient() {
  // selections drive dependent lanes
  const [upazilas, setupazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [wards, setWards] = useState([]);

  const [selupazilaId, setSelupazilaId] = useState("");
  const [selUnionId, setSelUnionId] = useState("");

  const [err, setErr] = useState("");
  const [loadingU, setLoadingU] = useState(false);
  const [loadingN, setLoadingN] = useState(false);
  const [loadingW, setLoadingW] = useState(false);

  // quick create inputs
  const [newupazila, setNewupazila] = useState("");
  const [newUnion, setNewUnion] = useState("");
  const [newWard, setNewWard] = useState("");

  // initial upazilas
  useEffect(() => {
    (async () => {
      try {
        setLoadingU(true);
        const res = await fetch(`/api/geo?type=upazila&active=1`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load upazilas");
        setupazilas(sorter(j.items || []));
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingU(false);
      }
    })();
  }, []);

  // unions depend on selected upazila
  useEffect(() => {
    (async () => {
      if (!selupazilaId) {
        setUnions([]);
        setSelUnionId("");
        setWards([]);
        return;
      }
      try {
        setLoadingN(true);
        const res = await fetch(
          `/api/geo?parentId=${encodeURIComponent(selupazilaId)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load unions");
        setUnions(sorter(j.items || []));
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingN(false);
      }
    })();
  }, [selupazilaId]);

  // wards depend on selected union
  useEffect(() => {
    (async () => {
      if (!selUnionId) {
        setWards([]);
        return;
      }
      try {
        setLoadingW(true);
        const res = await fetch(
          `/api/geo?parentId=${encodeURIComponent(selUnionId)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load wards");
        setWards(sorter(j.items || []));
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingW(false);
      }
    })();
  }, [selUnionId]);

  // ----- CRUD helpers -----
  async function createupazila(e) {
    e.preventDefault();
    if (!newupazila.trim()) return;
    const res = await fetch(`/api/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "upazila",
        name: newupazila.trim(),
        active: true,
        sort: upazilas.length
          ? (upazilas[upazilas.length - 1].sort ?? 0) + 1
          : 0,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Create failed");
      return;
    }
    setNewupazila("");
    await reloadupazilas();
  }

  async function createUnion(e) {
    e.preventDefault();
    if (!selupazilaId || !newUnion.trim()) return;
    const res = await fetch(`/api/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "union",
        name: newUnion.trim(),
        parentId: selupazilaId,
        active: true,
        sort: unions.length ? (unions[unions.length - 1].sort ?? 0) + 1 : 0,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Create failed");
      return;
    }
    setNewUnion("");
    await reloadUnions();
  }

  async function createWard(e) {
    e.preventDefault();
    if (!selUnionId || !newWard.trim()) return;
    const res = await fetch(`/api/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ward",
        name: newWard.trim(),
        parentId: selUnionId,
        active: true,
        sort: wards.length ? (wards[wards.length - 1].sort ?? 0) + 1 : 0,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Create failed");
      return;
    }
    setNewWard("");
    await reloadWards();
  }

  async function reloadupazilas() {
    const r = await fetch(`/api/geo?type=upazila&active=1`, {
      cache: "no-store",
    });
    const jj = await r.json();
    setupazilas(sorter(jj.items || []));
  }
  async function reloadUnions() {
    if (!selupazilaId) return;
    const r = await fetch(
      `/api/geo?parentId=${encodeURIComponent(selupazilaId)}&active=1`,
      { cache: "no-store" }
    );
    const jj = await r.json();
    setUnions(sorter(jj.items || []));
  }
  async function reloadWards() {
    if (!selUnionId) return;
    const r = await fetch(
      `/api/geo?parentId=${encodeURIComponent(selUnionId)}&active=1`,
      { cache: "no-store" }
    );
    const jj = await r.json();
    setWards(sorter(jj.items || []));
  }

  // rename / toggle active
  async function renameItem(id, name, refresh) {
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
    await refresh();
  }
  async function toggleActive(id, active, refresh) {
    const res = await fetch(`/api/geo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Update failed");
      return;
    }
    await refresh();
  }

  // DnD helpers
  function onDragStart(e, payload) {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }
  function readPayload(e) {
    try {
      return JSON.parse(e.dataTransfer.getData("application/json") || "{}");
    } catch {
      return {};
    }
  }

  // Drop on card of SAME level → reorder (swap)
  async function onDropSwap(e, target, level) {
    e.preventDefault();
    const p = readPayload(e);
    if (!p?.id || p.level !== level || p.id === target._id) return;
    const res = await fetch(`/api/geo/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapWithId: target._id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Swap failed");
      return;
    }
    await (level === "upazila"
      ? reloadupazilas()
      : level === "union"
      ? reloadUnions()
      : reloadWards());
  }

  // Drop a child on a PARENT card to re-parent
  async function onDropReparent(e, newParent, acceptsLevel) {
    e.preventDefault();
    const p = readPayload(e);
    // re-parent union → upazila
    if (acceptsLevel === "upazila" && p.level === "union") {
      const res = await fetch(`/api/geo/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: newParent._id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Move failed");
        return;
      }
      await reloadUnions();
      if (selUnionId) await reloadWards();
      return;
    }
    // re-parent ward → union
    if (acceptsLevel === "union" && p.level === "ward") {
      const res = await fetch(`/api/geo/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: newParent._id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Move failed");
        return;
      }
      await reloadWards();
      return;
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Location Kanban (upazila → Union → Ward)
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/geo/explorer"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            Two-pane
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

      {err && (
        <div className="rounded border bg-white p-3 text-sm text-red-600">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* upazila lane */}
        <Lane
          title="upazilas"
          color="indigo"
          loading={loadingU}
          items={upazilas}
          selectedId={selupazilaId}
          onSelect={(id) => {
            setSelupazilaId(id);
            setSelUnionId("");
          }}
          onDragStart={(e, it) =>
            onDragStart(e, { id: it._id, level: "upazila" })
          }
          onDropCard={(e, it) => onDropSwap(e, it, "upazila")}
          onDropOnCardAsParent={(e, it) => onDropReparent(e, it, "upazila")}
          onRename={(id, name) => renameItem(id, name, reloadupazilas)}
          onToggle={(id, val) => toggleActive(id, val, reloadupazilas)}
          form={{
            placeholder: "New upazila name",
            value: newupazila,
            onChange: setNewupazila,
            onSubmit: createupazila,
          }}
          hint="Tip: Drag a Union card here (onto an upazila card) to re-assign its parent."
        />

        {/* Union lane */}
        <Lane
          title={selupazilaId ? "Unions" : "Select an upazila"}
          color="amber"
          loading={loadingN}
          items={unions}
          selectedId={selUnionId}
          onSelect={(id) => setSelUnionId(id)}
          onDragStart={(e, it) =>
            onDragStart(e, { id: it._id, level: "union" })
          }
          onDropCard={(e, it) => onDropSwap(e, it, "union")}
          onDropOnCardAsParent={(e, it) => onDropReparent(e, it, "union")}
          onRename={(id, name) => renameItem(id, name, reloadUnions)}
          onToggle={(id, val) => toggleActive(id, val, reloadUnions)}
          form={
            selupazilaId
              ? {
                  placeholder: "New union name",
                  value: newUnion,
                  onChange: setNewUnion,
                  onSubmit: createUnion,
                }
              : null
          }
          hint={
            selupazilaId
              ? "Drag a Ward card here (onto a Union card) to re-assign its parent."
              : ""
          }
        />

        {/* Ward lane */}
        <Lane
          title={selUnionId ? "Wards" : "Select a Union"}
          color="blue"
          loading={loadingW}
          items={wards}
          onDragStart={(e, it) => onDragStart(e, { id: it._id, level: "ward" })}
          onDropCard={(e, it) => onDropSwap(e, it, "ward")}
          onRename={(id, name) => renameItem(id, name, reloadWards)}
          onToggle={(id, val) => toggleActive(id, val, reloadWards)}
          form={
            selUnionId
              ? {
                  placeholder: "New ward name",
                  value: newWard,
                  onChange: setNewWard,
                  onSubmit: createWard,
                }
              : null
          }
        />
      </div>
    </div>
  );
}

function Lane({
  title,
  color = "gray",
  loading,
  items,
  selectedId,
  onSelect,
  onDragStart,
  onDropCard,
  onDropOnCardAsParent, // optional: unions drop on upazila, wards drop on union
  onRename,
  onToggle,
  form,
  hint,
}) {
  return (
    <section className="rounded border bg-white flex flex-col">
      <div className={`border-b p-3 bg-${color}-50/50`}>
        <div className="text-sm font-medium">{title}</div>
      </div>

      {form && (
        <form
          onSubmit={form.onSubmit}
          className="p-3 border-b flex items-end gap-2"
        >
          <input
            className="border rounded px-3 py-2 text-sm flex-1"
            placeholder={form.placeholder}
            value={form.value}
            onChange={(e) => form.onChange(e.target.value)}
            required
          />
          <button className="bg-blue-600 text-white px-3 py-2 rounded text-sm">
            Add
          </button>
        </form>
      )}

      {hint && (
        <div className="px-3 py-2 text-xs text-gray-500 border-b">{hint}</div>
      )}

      <div className="flex-1 overflow-auto divide-y">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : (items || []).length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No items</div>
        ) : (
          items.map((it) => (
            <KanbanCard
              key={it._id}
              item={it}
              selected={selectedId && selectedId === it._id}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDropCard={onDropCard}
              onDropOnCardAsParent={onDropOnCardAsParent}
              onRename={onRename}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </section>
  );
}

function KanbanCard({
  item,
  selected,
  onSelect,
  onDragStart,
  onDropCard,
  onDropOnCardAsParent,
  onRename,
  onToggle,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name || "");
  const active = item.active !== false;

  return (
    <div
      className={`p-3 ${selected ? "bg-blue-50" : ""}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, item)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // If this card can accept re-parent (i.e., it's a parent target), try that first,
        // else treat as swap target (same-level reorder).
        if (onDropOnCardAsParent) onDropOnCardAsParent(e, item);
        else onDropCard?.(e, item);
      }}
    >
      <div className="flex items-start gap-3">
        <button
          className="text-left font-medium"
          onClick={() => onSelect?.(item._id)}
        >
          {item.name}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onToggle?.(item._id, e.target.checked)}
            />
            Active
          </label>
        </div>
      </div>

      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="px-2 py-1 border rounded text-sm"
            onClick={async () => {
              if (!name.trim()) return;
              await onRename?.(item._id, name.trim());
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
        </div>
      ) : (
        <div className="mt-1">
          <button
            className="text-blue-600 underline text-xs"
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
        </div>
      )}
    </div>
  );
}

function sorter(arr) {
  return [...arr].sort((a, b) => {
    const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0;
    const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0;
    return sa - sb || String(a.name).localeCompare(String(b.name));
  });
}
