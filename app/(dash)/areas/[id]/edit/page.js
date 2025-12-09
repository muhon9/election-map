"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import PeopleEditor from "@/components/PeopleEditor";

export default function AreaEditPage() {
  const { id } = useParams(); // /areas/[id]/edit
  const router = useRouter();
  const sp = useSearchParams();

  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  const [area, setArea] = useState(null);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    code: "",
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
    notes: "",
    shapeJson: "", // raw GeoJSON text
    locationLat: "",
    locationLng: "",
  });

  // Selected People tab (URL-driven and reactive)
  const tabParam = (sp.get("tab") || sp.get("add") || "").toUpperCase();
  const validTabs = ["COMMITTEE", "RENOWNED", "CONTACT"];
  const [peopleTab, setPeopleTab] = useState(
    validTabs.includes(tabParam) ? tabParam : "COMMITTEE"
  );

  useEffect(() => {
    const t = (sp.get("tab") || sp.get("add") || "").toUpperCase();
    if (validTabs.includes(t)) setPeopleTab(t);
  }, [sp]);

  // Area Info collapse/expand
  const [areaOpen, setAreaOpen] = useState(true);
  const areaRef = useRef(null);
  function toggleArea() {
    setAreaOpen((o) => {
      const next = !o;
      if (next) {
        setTimeout(() => {
          areaRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 0);
      }
      return next;
    });
  }

  // Load area
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/areas/${id}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load area");
        setArea(j);

        // Prepare shape JSON text (prefer rawGeoJSON if present)
        let shapeJson = "";
        if (j.shape) {
          if (j.shape.rawGeoJSON) {
            shapeJson = JSON.stringify(j.shape.rawGeoJSON, null, 2);
          } else {
            shapeJson = JSON.stringify(
              { type: j.shape.type, coordinates: j.shape.coordinates },
              null,
              2
            );
          }
        }

        // Prepare location lat/lng (GeoJSON Point: [lng, lat])
        let locationLat = "";
        let locationLng = "";
        if (
          j.location &&
          j.location.type === "Point" &&
          Array.isArray(j.location.coordinates) &&
          j.location.coordinates.length === 2
        ) {
          const [lng, lat] = j.location.coordinates;
          locationLat = lat ?? "";
          locationLng = lng ?? "";
        }

        setForm({
          name: j.name || "",
          code: j.code || "",
          totalVoters: j.totalVoters ?? "",
          maleVoters: j.maleVoters ?? "",
          femaleVoters: j.femaleVoters ?? "",
          notes: j.notes || "",
          shapeJson,
          locationLat: locationLat === "" ? "" : String(locationLat),
          locationLng: locationLng === "" ? "" : String(locationLng),
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load area");
        setArea(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load parent center (for header links)
  useEffect(() => {
    if (!area?.center) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/centers/${area.center}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!alive) return;
        if (res.ok) setCenter(j);
      } catch {
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [area?.center]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      name: (form.name || "").trim(),
      code: (form.code || "").trim(),
      totalVoters: Number(form.totalVoters || 0),
      maleVoters: Number(form.maleVoters || 0),
      femaleVoters: Number(form.femaleVoters || 0),
      notes: (form.notes || "").trim(),
    };

    // Shape handling
    const trimmedShape = (form.shapeJson || "").trim();
    if (trimmedShape) {
      try {
        const parsed = JSON.parse(trimmedShape);

        let geom = parsed;
        // Accept FeatureCollection / Feature / bare geometry
        if (parsed.type === "FeatureCollection") {
          geom = parsed.features?.[0]?.geometry;
        } else if (parsed.type === "Feature") {
          geom = parsed.geometry;
        }

        if (!geom || !geom.type || !geom.coordinates) {
          alert(
            "Invalid GeoJSON: could not find geometry (type/coordinates missing)."
          );
          return;
        }

        if (!["Polygon", "MultiPolygon"].includes(geom.type)) {
          alert("Only Polygon or MultiPolygon are supported for area shapes.");
          return;
        }

        payload.shape = {
          type: geom.type,
          coordinates: geom.coordinates,
          rawGeoJSON: parsed,
        };
      } catch (e2) {
        console.error(e2);
        alert("Invalid GeoJSON in shape field. Please check your JSON.");
        return;
      }
    } else {
      // explicitly clear shape if empty
      payload.shape = null;
    }

    // Location handling (lat/lng -> GeoJSON Point)
    const latStr = (form.locationLat || "").trim();
    const lngStr = (form.locationLng || "").trim();
    if (latStr || lngStr) {
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (
        Number.isNaN(lat) ||
        Number.isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        alert(
          "Location must have valid numeric latitude (-90..90) and longitude (-180..180)."
        );
        return;
      }
      payload.location = {
        type: "Point",
        coordinates: [lng, lat],
      };
    } else {
      // clear location if both empty
      payload.location = null;
    }

    // Soft validation
    if (payload.totalVoters < payload.maleVoters + payload.femaleVoters) {
      const ok = confirm("Total voters is less than Male + Female. Continue?");
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/areas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to update area");
        return;
      }
      setArea(j);

      // Re-sync form (including shape + location)
      let shapeJson = "";
      if (j.shape) {
        if (j.shape.rawGeoJSON) {
          shapeJson = JSON.stringify(j.shape.rawGeoJSON, null, 2);
        } else {
          shapeJson = JSON.stringify(
            { type: j.shape.type, coordinates: j.shape.coordinates },
            null,
            2
          );
        }
      }

      let locationLat = "";
      let locationLng = "";
      if (
        j.location &&
        j.location.type === "Point" &&
        Array.isArray(j.location.coordinates) &&
        j.location.coordinates.length === 2
      ) {
        const [lng2, lat2] = j.location.coordinates;
        locationLat = lat2 ?? "";
        locationLng = lng2 ?? "";
      }

      setForm({
        name: j.name || "",
        code: j.code || "",
        totalVoters: j.totalVoters ?? "",
        maleVoters: j.maleVoters ?? "",
        femaleVoters: j.femaleVoters ?? "",
        notes: j.notes || "",
        shapeJson,
        locationLat: locationLat === "" ? "" : String(locationLat),
        locationLng: locationLng === "" ? "" : String(locationLng),
      });
      alert("Area updated.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!canDelete) return;
    if (!confirm("Delete this area? This cannot be undone.")) return;
    const res = await fetch(`/api/areas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete area");
      return;
    }
    if (center?._id) router.push(`/centers/${center._id}`);
    else router.push("/centers");
  }

  const headerSubtitle = useMemo(() => {
    if (!center) return null;
    return (
      <div className="text-sm text-gray-600">
        In center:{" "}
        <a className="text-blue-600 underline" href={`/centers/${center._id}`}>
          {center.name}
        </a>
        {area?.code && (
          <span className="ml-2 text-gray-500">• Code: {area.code}</span>
        )}
      </div>
    );
  }, [center, area?.code]);

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
          <a className="text-sm text-blue-600 underline" href="/centers">
            All centers
          </a>
          {center?._id && (
            <a
              className="text-sm text-blue-600 underline"
              href={`/centers/${center._id}`}
            >
              Parent center
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              className="px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Heading */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {loading ? "Loading…" : area?.name || "Edit Area"}
          </h1>
          {headerSubtitle}
        </div>
      </header>

      {/* Error / Loading */}
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading area…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Content */}
      {!loading && !err && area && (
        <>
          {/* AREA INFO (collapsible) */}
          <section ref={areaRef} className="rounded border bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-base font-semibold">Area Info</h2>
              <button
                type="button"
                className="text-sm text-blue-700 underline"
                onClick={toggleArea}
                title={areaOpen ? "Collapse Area Info" : "Expand Area Info"}
              >
                {areaOpen ? "Collapse ↑" : "Expand ↓"}
              </button>
            </div>

            {areaOpen && (
              <div className="p-4">
                <form
                  onSubmit={onSubmit}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Area Name
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

                  <div className="md:col-span-1">
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

                  <div className="md:col-span-1"></div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.totalVoters}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, totalVoters: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Male Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.maleVoters}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, maleVoters: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Female Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.femaleVoters}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          femaleVoters: e.target.value,
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      className="border rounded w-full px-3 py-2"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  {/* NEW: Location lat/lng */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Location latitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        className="border rounded w-full px-3 py-2"
                        value={form.locationLat}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            locationLat: e.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        placeholder="24.89…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Location longitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        className="border rounded w-full px-3 py-2"
                        value={form.locationLng}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            locationLng: e.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        placeholder="91.86…"
                      />
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-end">
                      <p>
                        Optional marker if no polygon. Leave both empty to clear
                        location.
                      </p>
                    </div>
                  </div>

                  {/* Shape GeoJSON textarea */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Area shape (GeoJSON)
                    </label>
                    <p className="text-[11px] text-gray-500 mb-1">
                      Paste a GeoJSON <code>FeatureCollection</code>,{" "}
                      <code>Feature</code>, or geometry (<code>Polygon</code>/
                      <code>MultiPolygon</code>) from geojson.io. Leave empty to
                      remove shape.
                    </p>
                    <textarea
                      rows={8}
                      className="border rounded w-full px-3 py-2 font-mono text-[11px]"
                      value={form.shapeJson}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, shapeJson: e.target.value }))
                      }
                      disabled={!canEdit}
                      placeholder='{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [ ... ]
  }
}'
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center gap-2">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={!canEdit || saving}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 border rounded hover:bg-gray-50"
                      onClick={() => router.back()}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          {/* PEOPLE MANAGEMENT (always open) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">People</h2>
            </div>

            <div className="rounded border bg-white p-3">
              <PeopleEditor
                areaId={String(id)}
                defaultCategory={peopleTab}
                hideCommitteeDesignation
                hideCommitteeOrder
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
