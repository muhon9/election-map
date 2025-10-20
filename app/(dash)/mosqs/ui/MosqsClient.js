// app/(dash)/mosqs/ui/MosqsClient.jsx
"use client";

import { useEffect, useState } from "react";

export default function MosqsClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // ---------- Create form state ----------
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formCenterId, setFormCenterId] = useState("");
  const [formAreaId, setFormAreaId] = useState("");
  const [formCenters, setFormCenters] = useState([]);
  const [formAreas, setFormAreas] = useState([]);
  const [lat, setLat] = useState(""); // optional; if empty -> 0
  const [lng, setLng] = useState(""); // optional; if empty -> 0
  const [saving, setSaving] = useState(false);

  // ---------- Table filter/search ----------
  const [q, setQ] = useState("");
  const [filterCenterId, setFilterCenterId] = useState("");
  const [filterAreaId, setFilterAreaId] = useState("");
  const [filterCenters, setFilterCenters] = useState([]);
  const [filterAreas, setFilterAreas] = useState([]);

  // ========== Helpers ==========
  async function fetchCenters() {
    const res = await fetch(`/api/centers?limit=500`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load centers");
    const items = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    return items;
  }

  async function fetchAreas(centerId) {
    // Areas only load when a center is selected
    if (!centerId) return [];
    const url = `/api/centers/${encodeURIComponent(centerId)}/areas`;
    const res = await fetch(url, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load areas");
    const items = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    return items;
  }

  async function fetchMosqs({ q = "", centerId = "", areaId = "" } = {}) {
    const sp = new URLSearchParams();
    sp.set("limit", "50");
    if (q) sp.set("q", q);
    if (centerId) sp.set("centerId", centerId);
    if (areaId) sp.set("areaId", areaId);
    const res = await fetch(`/api/mosqs?${sp.toString()}`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load mosqs");
    return j?.items || [];
  }

  // ========== Initial load ==========
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const centers = await fetchCenters();
        setFormCenters(centers);
        setFilterCenters(centers);

        // No areas until a center is picked (both form + filters)
        setFormAreas([]);
        setFilterAreas([]);

        // Initial mosq list
        const list = await fetchMosqs();
        setRows(list);
      } catch (e) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ========== Dependent Areas (Create Form) ==========
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!formCenterId) {
          setFormAreas([]);
          setFormAreaId("");
          return;
        }
        const items = await fetchAreas(formCenterId);
        if (!alive) return;
        setFormAreas(items);
        if (!items.find((a) => a._id === formAreaId)) setFormAreaId("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load areas");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formCenterId]);

  // ========== Dependent Areas (Table Filters) ==========
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!filterCenterId) {
          setFilterAreas([]);
          setFilterAreaId("");
          return;
        }
        const items = await fetchAreas(filterCenterId);
        if (!alive) return;
        setFilterAreas(items);
        if (!items.find((a) => a._id === filterAreaId)) setFilterAreaId("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load areas");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCenterId]);

  // ========== Actions ==========
  async function reloadList() {
    try {
      setLoading(true);
      setErr("");
      const list = await fetchMosqs({
        q,
        centerId: filterCenterId,
        areaId: filterAreaId,
      });
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    // Name required; center/area optional now
    if (!name) {
      alert("Name is required");
      return;
    }

    // If lat/lng blank, send 0; if provided, parse to float
    const latNum = lat === "" ? 0 : Number.parseFloat(lat);
    const lngNum = lng === "" ? 0 : Number.parseFloat(lng);
    const safeLat = Number.isFinite(latNum) ? latNum : 0;
    const safeLng = Number.isFinite(lngNum) ? lngNum : 0;

    setSaving(true);
    try {
      const payload = {
        name,
        address,
        // Only include when selected (optional)
        ...(formCenterId ? { centerId: formCenterId } : {}),
        ...(formAreaId ? { areaId: formAreaId } : {}),
        location: { lat: safeLat, lng: safeLng }, // always include; defaults to 0s if blank
      };

      const res = await fetch(`/api/mosqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to create");
        return;
      }

      // reset form
      setName("");
      setAddress("");
      setFormCenterId("");
      setFormAreaId("");
      setFormAreas([]);
      setLat("");
      setLng("");

      await reloadList();
      alert("Mosq created.");
    } finally {
      setSaving(false);
    }
  }

  // ========== Render ==========
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold">Mosqs</h1>

      {/* Create form */}
      <form
        onSubmit={onCreate}
        className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            className="border rounded w-full px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            className="border rounded w-full px-3 py-2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Center (optional)
          </label>
          <select
            className="border rounded w-full px-3 py-2"
            value={formCenterId}
            onChange={(e) => setFormCenterId(e.target.value)}
          >
            <option value="">— None —</option>
            {formCenters.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Area (optional)
          </label>
          <select
            className="border rounded w-full px-3 py-2"
            value={formAreaId}
            onChange={(e) => setFormAreaId(e.target.value)}
            disabled={!formCenterId}
            title={
              !formCenterId
                ? "Select a center to choose its areas (optional)"
                : ""
            }
          >
            <option value="">
              {formCenterId ? "— None —" : "Select a center first"}
            </option>
            {formAreas.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Lat / Lng (optional; default to 0) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Latitude (optional)
          </label>
          <input
            className="border rounded w-full px-3 py-2"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="e.g., 23.7773"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Longitude (optional)
          </label>
          <input
            className="border rounded w-full px-3 py-2"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="e.g., 90.3995"
            inputMode="decimal"
          />
        </div>

        <div className="md:col-span-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : "Create Mosq"}
          </button>
        </div>
      </form>

      {/* Filters */}
      <section className="rounded border bg-white p-4">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              placeholder="Search by name or address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Center
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={filterCenterId}
              onChange={(e) => setFilterCenterId(e.target.value)}
            >
              <option value="">All centers</option>
              {filterCenters.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Area
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={filterAreaId}
              onChange={(e) => setFilterAreaId(e.target.value)}
              disabled={!filterCenterId}
              title={!filterCenterId ? "Select center to filter areas" : ""}
            >
              <option value="">
                {filterCenterId
                  ? "All areas in center"
                  : "Select a center first"}
              </option>
              {filterAreas.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={reloadList}
          >
            Apply
          </button>
          <button
            className="px-4 py-2 rounded border"
            onClick={async () => {
              setQ("");
              setFilterCenterId("");
              setFilterAreaId("");
              setFilterAreas([]);
              await reloadList();
            }}
          >
            Reset
          </button>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      ) : err ? (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th>Center</Th>
                <Th>Area</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No mosqs found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-t">
                    <Td>{r.name}</Td>
                    <Td>{r.address || "-"}</Td>
                    <Td>{r.center?.name || "-"}</Td>
                    <Td>{r.area?.name || "-"}</Td>
                    <Td>
                      <a
                        className="text-blue-600 underline"
                        href={`/mosqs/${r._id}`}
                      >
                        Edit
                      </a>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left p-2">{children}</th>;
}
function Td({ children }) {
  return <td className="p-2">{children}</td>;
}
