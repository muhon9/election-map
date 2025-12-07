"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  const txt = await r.text();
  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error("Failed to parse server response");
  }
  if (!r.ok) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

export default function GeoEditPage() {
  const { id } = useParams(); // /geo/[id]/edit
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "manage_roles");

  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    sort: 0,
    active: true,
    type: "",
    parentName: "",
    shapeText: "",
  });

  // Load geo unit
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const j = await fetchJSON(`/api/geo/${id}`);
        if (!alive) return;

        setGeo(j);

        let shapeText = "";
        if (j.shape) {
          // You can choose to show just geometry or wrap as Feature
          // Here we show the raw geometry (Polygon/MultiPolygon)
          shapeText = JSON.stringify(j.shape, null, 2);
        }

        setForm({
          name: j.name || "",
          code: j.code || "",
          sort: j.sort ?? 0,
          active: !!j.active,
          type: j.type || "",
          parentName: j.parent?.name || "",
          shapeText,
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load geo unit");
        setGeo(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      name: (form.name || "").trim(),
      code: (form.code || "").trim(),
      sort: Number(form.sort) || 0,
      active: !!form.active,
    };

    const shapeStr = (form.shapeText || "").trim();
    if (shapeStr) {
      let parsed;
      try {
        parsed = JSON.parse(shapeStr);
      } catch {
        alert("Shape is not valid JSON. Please paste valid GeoJSON.");
        return;
      }
      payload.shape = parsed; // backend accepts Feature or Geometry
    } else {
      // Explicitly clear shape
      payload.shape = null;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/geo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      let j = {};
      try {
        j = txt ? JSON.parse(txt) : {};
      } catch {
        // ignore
      }

      if (!res.ok) {
        alert(j?.error || "Failed to update geo unit");
        return;
      }

      setGeo(j);

      let newShapeText = "";
      if (j.shape) {
        newShapeText = JSON.stringify(j.shape, null, 2);
      }

      setForm((f) => ({
        ...f,
        name: j.name || "",
        code: j.code || "",
        sort: j.sort ?? 0,
        active: !!j.active,
        type: j.type || "",
        parentName: j.parent?.name || "",
        shapeText: newShapeText,
      }));

      alert("Saved.");
    } catch (e) {
      alert(e.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    router.back();
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
            onClick={() => router.back()}
          >
            ← Back
          </button>
          <a className="text-sm text-blue-600 underline" href="/geo/list">
            All geo units
          </a>
        </div>
      </div>

      {/* Heading */}
      <header>
        <h1 className="text-xl font-semibold">
          {loading ? "Loading…" : geo?.name || "Edit geo unit"}
        </h1>
        {!loading && geo && (
          <div className="text-sm text-gray-600 mt-1">
            <span className="inline-block mr-2">
              Type: <b>{geo.type}</b>
            </span>
            {geo.parent && (
              <span className="inline-block">
                Parent:{" "}
                <a
                  className="text-blue-600 underline"
                  href={`/geo/${geo.parent._id}/edit`}
                >
                  {geo.parent.name}
                </a>
              </span>
            )}
          </div>
        )}
      </header>

      {/* Error / loading */}
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading geo unit…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Form */}
      {!loading && !err && geo && (
        <form
          onSubmit={onSubmit}
          className="rounded border bg-white p-4 space-y-4"
        >
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Sort order
              </label>
              <input
                type="number"
                className="border rounded w-full px-3 py-2"
                value={form.sort}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type
              </label>
              <input
                className="border rounded w-full px-3 py-2 bg-gray-50 text-gray-600"
                value={form.type}
                disabled
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Parent
              </label>
              <input
                className="border rounded w-full px-3 py-2 bg-gray-50 text-gray-600"
                value={form.parentName}
                disabled
              />
            </div>

            <div className="flex items-center gap-2 mt-5 md:mt-7">
              <input
                id="geo-active"
                type="checkbox"
                className="h-4 w-4"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                disabled={!canEdit}
              />
              <label
                htmlFor="geo-active"
                className="text-sm text-gray-700 select-none"
              >
                Active
              </label>
            </div>
          </div>

          {/* Shape editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Polygon shape</h2>
              <button
                type="button"
                className="text-xs text-gray-600 underline"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    shapeText: "",
                  }))
                }
                disabled={!canEdit}
              >
                Clear shape
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Paste GeoJSON here. You can paste either:
              <br />• a <code className="font-mono">Polygon</code> or{" "}
              <code className="font-mono">MultiPolygon</code> geometry (
              {"{ type, coordinates }"}) or
              <br />• a full <code className="font-mono">Feature</code> from
              geojson.io ({"{ type: 'Feature', geometry: {{...}} }"}).
            </p>
            <textarea
              rows={12}
              className="border rounded w-full px-3 py-2 font-mono text-xs"
              placeholder='Example: { "type": "Polygon", "coordinates": [...] }'
              value={form.shapeText}
              onChange={(e) =>
                setForm((f) => ({ ...f, shapeText: e.target.value }))
              }
              disabled={!canEdit}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={!canEdit || saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="border px-4 py-2 rounded hover:bg-gray-50"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
