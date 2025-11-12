"use client";

import { useEffect, useState, Fragment } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import PeopleEditor from "@/components/PeopleEditor";

export default function CenterCreatePage() {
  const { data: session } = useSession();
  const user = session?.user;

  const canEdit = has(user, "edit_center");
  const canDel = has(user, "delete_center");

  // Step 1 — Center form
  const [centerId, setCenterId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [centerForm, setCenterForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    contactName: "",
    contactPhone: "",
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
    notes: "",
  });

  // -------- Geo admin picks (City or Upazila path) --------
  const [mode, setMode] = useState("city"); // "city" | "rural"

  // selected IDs
  const [cityId, setCityId] = useState("");
  const [cityWardId, setCityWardId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [ruralWardId, setRuralWardId] = useState("");

  // options
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  // load base lists on mount
  useEffect(() => {
    (async () => {
      try {
        const [ccRes, upaRes] = await Promise.all([
          fetch("/api/geo?type=city_corporation&active=1", {
            cache: "no-store",
          }),
          fetch("/api/geo?type=upazila&active=1", { cache: "no-store" }),
        ]);
        const [ccJ, upaJ] = await Promise.all([ccRes.json(), upaRes.json()]);
        setCityCorps(ccJ.items || []);
        setUpazilas(upaJ.items || []);
      } catch (e) {
        console.error("Load base geo lists failed", e);
      }
    })();
  }, []);

  // when city changes → load city wards, clear rural path
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      setCityWardId("");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/geo?parentId=${cityId}&active=1`, {
          cache: "no-store",
        });
        const j = await r.json();
        setCityWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    // clear rural path if switching
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
    setMode("city");
  }, [cityId]);

  // when upazila changes → load unions, clear city path
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      setUnionId("");
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/geo?parentId=${upazilaId}&active=1`, {
          cache: "no-store",
        });
        const j = await r.json();
        setUnions(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    // clear city path if switching
    setCityId("");
    setCityWardId("");
    setMode("rural");
  }, [upazilaId]);

  // when union changes → load rural wards
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/geo?parentId=${unionId}&active=1`, {
          cache: "no-store",
        });
        const j = await r.json();
        setRuralWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [unionId]);

  function chooseMode(next) {
    setMode(next);
    if (next === "city") {
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      setCityId("");
      setCityWardId("");
    }
  }
  // -----------------------------------------------------------

  // Step 2 — Areas
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areaForm, setAreaForm] = useState({
    name: "",
    code: "",
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
    notes: "",
  });

  // UI: expand area to show PeopleEditor
  const [openAreaId, setOpenAreaId] = useState(null);

  async function createCenter(e) {
    e.preventDefault();
    if (!canEdit) return;

    // minimal validation
    const name = (centerForm.name || "").trim();
    if (!name) return alert("Center name is required");

    const payload = {
      name,
      address: (centerForm.address || "").trim(),
      lat: Number(centerForm.lat || 0),
      lng: Number(centerForm.lng || 0),
      contactName: (centerForm.contactName || "").trim(),
      contactPhone: (centerForm.contactPhone || "").trim(),
      totalVoters: Number(centerForm.totalVoters || 0),
      maleVoters: Number(centerForm.maleVoters || 0),
      femaleVoters: Number(centerForm.femaleVoters || 0),
      notes: (centerForm.notes || "").trim(),
    };

    // attach geo refs based on chosen path
    if (mode === "city") {
      payload.cityId = cityId || null;
      payload.wardId = cityWardId || null; // city ward
      // clear rural path to be explicit
      payload.upazilaId = null;
      payload.unionId = null;
    } else {
      payload.upazilaId = upazilaId || null;
      payload.unionId = unionId || null;
      payload.wardId = ruralWardId || null; // rural ward
      // clear city path to be explicit
      payload.cityId = null;
    }

    // Optional rule: total >= male+female (warn only)
    if (payload.totalVoters < payload.maleVoters + payload.femaleVoters) {
      if (!confirm("Total voters is less than Male + Female. Continue?"))
        return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to create center");
        return;
      }
      setCenterId(j._id);
      await loadAreas(j._id);
      setTimeout(() => {
        document
          .getElementById("areas-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } finally {
      setSaving(false);
    }
  }

  async function loadAreas(cId = centerId) {
    if (!cId) return;
    setAreasLoading(true);
    try {
      const res = await fetch(
        `/api/centers/${cId}/areas?page=1&limit=100&sort=createdAt&dir=desc`,
        { cache: "no-store" }
      );
      const j = await res.json();
      setAreas(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setAreasLoading(false);
    }
  }

  async function addArea(e) {
    e.preventDefault();
    if (!canEdit || !centerId) return;

    const payload = {
      name: (areaForm.name || "").trim(),
      code: (areaForm.code || "").trim(),
      totalVoters: Number(areaForm.totalVoters || 0),
      maleVoters: Number(areaForm.maleVoters || 0),
      femaleVoters: Number(areaForm.femaleVoters || 0),
      notes: (areaForm.notes || "").trim(),
    };
    if (!payload.name) return alert("Area name is required");

    if (payload.totalVoters < payload.maleVoters + payload.femaleVoters) {
      if (!confirm("Area total voters is less than Male + Female. Continue?"))
        return;
    }

    const res = await fetch(`/api/centers/${centerId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to add area");
      return;
    }
    setAreaForm({
      name: "",
      code: "",
      totalVoters: "",
      maleVoters: "",
      femaleVoters: "",
      notes: "",
    });
    await loadAreas();
  }

  async function deleteArea(areaId) {
    if (!canDel) return;
    if (!confirm("Delete this area? This cannot be undone.")) return;
    const res = await fetch(`/api/areas/${areaId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete area");
      return;
    }
    if (openAreaId === areaId) setOpenAreaId(null);
    await loadAreas();
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create Center</h1>
        <a className="text-blue-600 underline" href="/centers">
          Back to Centers
        </a>
      </header>

      {/* Step 1 — Center form */}
      <section className="space-y-3">
        <div className="p-4 border rounded bg-white">
          {!canEdit && (
            <p className="text-sm text-gray-600 mb-3">
              You don’t have permission to create centers. (view-only)
            </p>
          )}
          <form
            onSubmit={createCenter}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Core fields */}
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Center Name
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={centerForm.name}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={!!centerId || !canEdit}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={centerForm.address}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, address: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                className="border rounded w-full px-3 py-2"
                value={centerForm.lat}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, lat: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                className="border rounded w-full px-3 py-2"
                value={centerForm.lng}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, lng: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={centerForm.contactName}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, contactName: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={centerForm.contactPhone}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, contactPhone: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Total Voters
              </label>
              <input
                type="number"
                min="0"
                className="border rounded w-full px-3 py-2"
                value={centerForm.totalVoters}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, totalVoters: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
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
                value={centerForm.maleVoters}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, maleVoters: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
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
                value={centerForm.femaleVoters}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, femaleVoters: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                className="border rounded w-full px-3 py-2"
                value={centerForm.notes}
                onChange={(e) =>
                  setCenterForm((f) => ({ ...f, notes: e.target.value }))
                }
                disabled={!!centerId || !canEdit}
              />
            </div>

            {/* -------- Administrative Location -------- */}
            <div className="md:col-span-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-700">
                  Administrative Location
                </span>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    type="button"
                    className={`px-2 py-1 border rounded ${
                      mode === "city"
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => chooseMode("city")}
                    disabled={!!centerId || !canEdit}
                    title="City Corporation → City Ward"
                  >
                    City
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1 border rounded ${
                      mode === "rural"
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => chooseMode("rural")}
                    disabled={!!centerId || !canEdit}
                    title="Upazila → Union → Ward"
                  >
                    Upazila
                  </button>
                </div>
              </div>

              {/* City path */}
              {mode === "city" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      City Corporation
                    </label>
                    <select
                      className="border rounded w-full px-3 py-2"
                      value={cityId}
                      onChange={(e) => setCityId(e.target.value)}
                      disabled={!!centerId || !canEdit}
                    >
                      <option value="">— Select City Corporation —</option>
                      {cityCorps.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      City Ward
                    </label>
                    <select
                      className="border rounded w-full px-3 py-2"
                      value={cityWardId}
                      onChange={(e) => setCityWardId(e.target.value)}
                      disabled={!cityId || !!centerId || !canEdit}
                    >
                      <option value="">— Select City Ward —</option>
                      {cityWards.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Rural path */}
              {mode === "rural" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Upazila
                    </label>
                    <select
                      className="border rounded w-full px-3 py-2"
                      value={upazilaId}
                      onChange={(e) => setUpazilaId(e.target.value)}
                      disabled={!!centerId || !canEdit}
                    >
                      <option value="">— Select Upazila —</option>
                      {upazilas.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Union
                    </label>
                    <select
                      className="border rounded w-full px-3 py-2"
                      value={unionId}
                      onChange={(e) => setUnionId(e.target.value)}
                      disabled={!upazilaId || !!centerId || !canEdit}
                    >
                      <option value="">— Select Union —</option>
                      {unions.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Ward (Union)
                    </label>
                    <select
                      className="border rounded w-full px-3 py-2"
                      value={ruralWardId}
                      onChange={(e) => setRuralWardId(e.target.value)}
                      disabled={!unionId || !!centerId || !canEdit}
                    >
                      <option value="">— Select Ward —</option>
                      {ruralWards.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            {/* -------- end Geo admin picks -------- */}

            <div className="md:col-span-3">
              {!centerId ? (
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={!canEdit || saving}
                >
                  {saving ? "Saving…" : "Save & Continue"}
                </button>
              ) : (
                <div className="text-sm text-green-700 font-medium">
                  Center created. You can add Areas below.
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Step 2 — Areas (only after center created) */}
      {centerId && (
        <section id="areas-section" className="space-y-4">
          <h2 className="text-lg font-semibold">Areas</h2>

          {canEdit && (
            <form
              onSubmit={addArea}
              className="p-4 border rounded bg-white grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Area Name
                </label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={areaForm.name}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Code (optional)
                </label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={areaForm.code}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Total Voters
                </label>
                <input
                  type="number"
                  min="0"
                  className="border rounded w-full px-3 py-2"
                  value={areaForm.totalVoters}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, totalVoters: e.target.value }))
                  }
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
                  value={areaForm.maleVoters}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, maleVoters: e.target.value }))
                  }
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
                  value={areaForm.femaleVoters}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, femaleVoters: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  className="border rounded w-full px-3 py-2"
                  value={areaForm.notes}
                  onChange={(e) =>
                    setAreaForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>

              <div className="md:col-span-3">
                <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
                  Add Area
                </button>
              </div>
            </form>
          )}

          <div className="rounded border overflow-hidden bg-white">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">M / F</th>
                  <th className="text-left p-2 w-[220px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {areasLoading && (
                  <tr>
                    <td className="p-3 text-gray-500" colSpan={5}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!areasLoading && areas.length === 0 && (
                  <tr>
                    <td className="p-3 text-gray-500" colSpan={5}>
                      No areas yet.
                    </td>
                  </tr>
                )}
                {!areasLoading &&
                  areas.map((a) => (
                    <Fragment key={a._id}>
                      <tr className="border-t hover:bg-gray-50">
                        <td className="p-2 font-medium">{a.name}</td>
                        <td className="p-2">{a.code || "—"}</td>
                        <td className="p-2">{a.totalVoters ?? 0}</td>
                        <td className="p-2">
                          {a.maleVoters ?? 0} / {a.femaleVoters ?? 0}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              onClick={() =>
                                setOpenAreaId((id) =>
                                  id === a._id ? null : a._id
                                )
                              }
                            >
                              {openAreaId === a._id
                                ? "Hide People"
                                : "Add People"}
                            </button>
                            <a
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              href={`/areas/${a._id}`}
                            >
                              Open
                            </a>
                            {canDel && (
                              <button
                                className="px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                                onClick={() => deleteArea(a._id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {openAreaId === a._id && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <div className="border-t bg-gray-50 p-4">
                              <h3 className="font-medium mb-2">
                                People in {a.name}
                              </h3>
                              <PeopleEditor areaId={String(a._id)} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
