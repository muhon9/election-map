// app/(dash)/geo/explorer3/ui/Explorer3Client.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function Explorer3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  // URL-backed selection
  const [upazilaId, setupazilaId] = useState(sp.get("upazilaId") || "");
  const [unionId, setUnionId] = useState(sp.get("unionId") || "");

  // Lists
  const [upazilas, setupazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [wards, setWards] = useState([]);

  const [loadingU, setLoadingU] = useState(false);
  const [loadingN, setLoadingN] = useState(false);
  const [loadingW, setLoadingW] = useState(false);
  const [err, setErr] = useState("");

  // keep URL in sync
  useEffect(() => {
    const qs = new URLSearchParams();
    if (upazilaId) qs.set("upazilaId", upazilaId);
    if (unionId) qs.set("unionId", unionId);
    router.replace(`/geo/explorer3?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upazilaId, unionId]);

  // Load upazilas (level 1)
  useEffect(() => {
    (async () => {
      try {
        setLoadingU(true);
        setErr("");
        const res = await fetch(`/api/geo?type=upazila&active=1`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load upazilas");
        const items = (j.items || []).sort(sorter);
        setupazilas(items);
        if (upazilaId && !items.find((x) => x._id === upazilaId)) {
          setupazilaId("");
          setUnionId("");
        }
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingU(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Unions by upazila (level 2)
  useEffect(() => {
    (async () => {
      if (!upazilaId) {
        setUnions([]);
        setUnionId("");
        setWards([]);
        return;
      }
      try {
        setLoadingN(true);
        setErr("");
        const res = await fetch(
          `/api/geo?parentId=${encodeURIComponent(upazilaId)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load unions");
        const items = (j.items || []).sort(sorter);
        setUnions(items);
        if (unionId && !items.find((x) => x._id === unionId)) {
          setUnionId("");
          setWards([]);
        }
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingN(false);
      }
    })();
  }, [upazilaId]);

  // Load Wards by Union (level 3)
  useEffect(() => {
    (async () => {
      if (!unionId) {
        setWards([]);
        return;
      }
      try {
        setLoadingW(true);
        setErr("");
        const res = await fetch(
          `/api/geo?parentId=${encodeURIComponent(unionId)}&active=1`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load wards");
        setWards((j.items || []).sort(sorter));
      } catch (e) {
        setErr(e.message || "Failed");
      } finally {
        setLoadingW(false);
      }
    })();
  }, [unionId]);

  // Quick create for children
  const [newUnionName, setNewUnionName] = useState("");
  const [newWardName, setNewWardName] = useState("");
  const [savingUnion, setSavingUnion] = useState(false);
  const [savingWard, setSavingWard] = useState(false);

  async function createUnion(e) {
    e.preventDefault();
    if (!upazilaId || !newUnionName.trim()) return;
    setSavingUnion(true);
    try {
      const res = await fetch(`/api/geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "union",
          name: newUnionName.trim(),
          parentId: upazilaId,
          active: true,
          sort: unions.length ? (unions[unions.length - 1].sort ?? 0) + 1 : 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Create failed");
        return;
      }
      setNewUnionName("");
      await reloadUnions();
    } finally {
      setSavingUnion(false);
    }
  }

  async function createWard(e) {
    e.preventDefault();
    if (!unionId || !newWardName.trim()) return;
    setSavingWard(true);
    try {
      const res = await fetch(`/api/geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ward",
          name: newWardName.trim(),
          parentId: unionId,
          active: true,
          sort: wards.length ? (wards[wards.length - 1].sort ?? 0) + 1 : 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Create failed");
        return;
      }
      setNewWardName("");
      await reloadWards();
    } finally {
      setSavingWard(false);
    }
  }

  async function reloadUnions() {
    if (!upazilaId) return;
    const r = await fetch(
      `/api/geo?parentId=${encodeURIComponent(upazilaId)}&active=1`,
      { cache: "no-store" }
    );
    const jj = await r.json();
    setUnions((jj.items || []).sort(sorter));
  }
  async function reloadWards() {
    if (!unionId) return;
    const r = await fetch(
      `/api/geo?parentId=${encodeURIComponent(unionId)}&active=1`,
      { cache: "no-store" }
    );
    const jj = await r.json();
    setWards((jj.items || []).sort(sorter));
  }

  // Toggle active, rename, and SWAP sort among siblings
  async function toggleActive(id, val, reloadFn) {
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
    await reloadFn();
  }
  async function rename(id, name, reloadFn) {
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
    await reloadFn();
  }
  async function swapWith(id, siblingId, reloadFn) {
    if (!siblingId) return;
    const res = await fetch(`/api/geo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapWithId: siblingId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Swap failed");
      return;
    }
    await reloadFn();
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Three-Step Hierarchy (upazila → Union → Ward)
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/geo/explorer"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            Two-pane
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
        {/* upazilas */}
        <Pane
          title="upazilas"
          loading={loadingU}
          items={upazilas}
          selectedId={upazilaId}
          onSelect={(id) => {
            setupazilaId(id);
            setUnionId("");
          }}
        />

        {/* Unions */}
        <Pane
          title={upazilaId ? "Unions of selected upazila" : "Pick an upazila"}
          loading={loadingN}
          items={unions}
          selectedId={unionId}
          onSelect={(id) => setUnionId(id)}
          controls={{
            canCreate: !!upazilaId,
            createLabel: "Add Union",
            name: newUnionName,
            onNameChange: setNewUnionName,
            onCreate: createUnion,
            saving: savingUnion,
          }}
          rowActions={(list, idx) => {
            const item = list[idx];
            const prev = list[idx - 1];
            const next = list[idx + 1];
            return {
              onUp: () => swapWith(item._id, prev?._id, reloadUnions),
              onDown: () => swapWith(item._id, next?._id, reloadUnions),
              onToggle: (val) => toggleActive(item._id, val, reloadUnions),
              onRename: (name) => rename(item._id, name, reloadUnions),
            };
          }}
        />

        {/* Wards */}
        <Pane
          title={unionId ? "Wards of selected Union" : "Pick a Union"}
          loading={loadingW}
          items={wards}
          controls={{
            canCreate: !!unionId,
            createLabel: "Add Ward",
            name: newWardName,
            onNameChange: setNewWardName,
            onCreate: createWard,
            saving: savingWard,
          }}
          rowActions={(list, idx) => {
            const item = list[idx];
            const prev = list[idx - 1];
            const next = list[idx + 1];
            return {
              onUp: () => swapWith(item._id, prev?._id, reloadWards),
              onDown: () => swapWith(item._id, next?._id, reloadWards),
              onToggle: (val) => toggleActive(item._id, val, reloadWards),
              onRename: (name) => rename(item._id, name, reloadWards),
            };
          }}
        />
      </div>
    </div>
  );
}

function Pane({
  title,
  loading,
  items,
  selectedId,
  onSelect,
  controls,
  rowActions,
}) {
  return (
    <section className="rounded border bg-white">
      <div className="border-b p-3">
        <div className="text-sm font-medium">{title}</div>
      </div>

      {controls?.canCreate && (
        <form
          onSubmit={controls.onCreate}
          className="p-3 border-b flex items-end gap-2"
        >
          <div className="grid flex-1">
            <label className="text-xs text-gray-600">Name</label>
            <input
              className="border rounded px-2 py-1 text-sm"
              value={controls.name}
              onChange={(e) => controls.onNameChange(e.target.value)}
              required
            />
          </div>
          <button
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
            disabled={controls.saving}
          >
            {controls.saving ? "Adding…" : controls.createLabel}
          </button>
        </form>
      )}

      <div className="max-h-[70vh] overflow-auto divide-y">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : items?.length ? (
          items.map((x, idx) => (
            <Row
              key={x._id}
              item={x}
              selected={selectedId && x._id === selectedId}
              onSelect={onSelect}
              actions={rowActions ? rowActions(items, idx) : null}
            />
          ))
        ) : (
          <div className="p-6 text-sm text-gray-500">No items</div>
        )}
      </div>
    </section>
  );
}

function Row({ item, selected, onSelect, actions }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name || "");
  const active = item.active !== false;

  return (
    <div className={`p-3 ${selected ? "bg-blue-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="font-medium text-left"
          onClick={() => onSelect?.(item._id)}
        >
          {item.name}
        </button>

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
                await actions.onRename(name.trim());
                setEditing(false);
              }}
            >
              Save
            </button>
            <button
              className="px-2 py-1 border rounded text-sm"
              onClick={() => {
                setEditing(false);
                setName(item.name || "");
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="text-blue-600 underline text-sm"
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {actions && (
            <>
              <button
                className="px-2 py-1 border rounded text-sm"
                onClick={actions.onUp}
                title="Move up"
              >
                ↑
              </button>
              <button
                className="px-2 py-1 border rounded text-sm"
                onClick={actions.onDown}
                title="Move down"
              >
                ↓
              </button>
            </>
          )}
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => actions?.onToggle(e.target.checked)}
            />
            Active
          </label>
        </div>
      </div>
    </div>
  );
}

function sorter(a, b) {
  const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0;
  const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0;
  return sa - sb || String(a.name).localeCompare(String(b.name));
}
