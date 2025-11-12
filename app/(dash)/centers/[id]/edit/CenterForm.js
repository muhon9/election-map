"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CenterForm({ center = null, onSaved }) {
  const router = useRouter();

  // -------- base form --------
  const [form, setForm] = useState({
    name: center?.name || "",
    address: center?.address || "",
    lat: center?.lat ?? "",
    lng: center?.lng ?? "",
    contactName: center?.contact?.name || "",
    contactPhone: center?.contact?.phone || "",
    notes: center?.notes || "",
    totalVoters: center?.totalVoters ?? 0,
    maleVoters: center?.maleVoters ?? 0,
    femaleVoters: center?.femaleVoters ?? 0,
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // -------- Geo admin picks (City or Upazila path) --------
  // infer initial mode from existing center (city path if cityId present)
  const initialMode = center?.cityId
    ? "city"
    : center?.upazilaId
    ? "rural"
    : "city";
  const [mode, setMode] = useState(initialMode); // "city" | "rural"

  // selected IDs (from existing center if present)
  const [cityId, setCityId] = useState(center?.cityId || "");
  // city ward == generic ward under a city
  const [cityWardId, setCityWardId] = useState(
    center?.cityId ? center?.wardId || "" : ""
  );

  const [upazilaId, setUpazilaId] = useState(center?.upazilaId || "");
  const [unionId, setUnionId] = useState(center?.unionId || "");
  // rural ward == generic ward under a union
  const [ruralWardId, setRuralWardId] = useState(
    center?.upazilaId ? center?.wardId || "" : ""
  );

  // options
  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // load top-level lists on mount
  useEffect(() => {
    (async () => {
      try {
        const [cityRes, upaRes] = await Promise.all([
          fetch("/api/geo?type=city_corporation&active=1", {
            cache: "no-store",
          }),
          fetch("/api/geo?type=upazila&active=1", { cache: "no-store" }),
        ]);
        const [cityJ, upaJ] = await Promise.all([
          cityRes.json(),
          upaRes.json(),
        ]);
        setCityCorps(cityJ.items || []);
        setUpazilas(upaJ.items || []);
      } catch (e) {
        console.error("Failed to load top-level geos", e);
      }
    })();
  }, []);

  // preload children if editing an existing center
  useEffect(() => {
    (async () => {
      try {
        // If editing with existing cityId -> load city wards
        if (center?.cityId) {
          const r = await fetch(`/api/geo?parentId=${center.cityId}&active=1`, {
            cache: "no-store",
          });
          const j = await r.json();
          setCityWards(j.items || []);
        }
        // If editing with existing upazilaId -> load unions
        if (center?.upazilaId) {
          const r = await fetch(
            `/api/geo?parentId=${center.upazilaId}&active=1`,
            { cache: "no-store" }
          );
          const j = await r.json();
          setUnions(j.items || []);
        }
        // If editing with existing unionId -> load rural wards
        if (center?.unionId) {
          const r = await fetch(
            `/api/geo?parentId=${center.unionId}&active=1`,
            { cache: "no-store" }
          );
          const j = await r.json();
          setRuralWards(j.items || []);
        }
      } catch (e) {
        console.error("Failed to preload child geos", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?._id]);

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

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    const payload = {
      name: form.name,
      address: form.address,
      lat: Number(form.lat),
      lng: Number(form.lng),
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      notes: form.notes,
      totalVoters: Number(form.totalVoters || 0),
      maleVoters: Number(form.maleVoters || 0),
      femaleVoters: Number(form.femaleVoters || 0),
    };

    // attach geo refs based on chosen path
    if (mode === "city") {
      payload.cityId = cityId || null;
      payload.wardId = cityWardId || null; // city ward
      // ensure rural path cleared
      payload.upazilaId = null;
      payload.unionId = null;
    } else {
      payload.cityId = null;
      payload.upazilaId = upazilaId || null;
      payload.unionId = unionId || null;
      payload.wardId = ruralWardId || null; // rural ward
    }

    try {
      const res = await fetch(
        center?._id ? `/api/centers/${center._id}` : `/api/centers`,
        {
          method: center?._id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      setSaving(false);

      if (!res.ok) {
        setErr(data?.error || "Failed to save center");
        return;
      }

      if (onSaved) onSaved(data);
      if (!center?._id) {
        router.push(`/centers/${data._id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setSaving(false);
      setErr("Network error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded border bg-white p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Center Name */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Center Name
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => u("name", e.target.value)}
            required
          />
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.address}
            onChange={(e) => u("address", e.target.value)}
          />
        </div>

        {/* Lat / Lng */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            className="w-full border rounded px-3 py-2"
            value={form.lat}
            onChange={(e) => u("lat", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            className="w-full border rounded px-3 py-2"
            value={form.lng}
            onChange={(e) => u("lng", e.target.value)}
            required
          />
        </div>

        {/* Contact */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Contact Name
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.contactName}
            onChange={(e) => u("contactName", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Contact Phone
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.contactPhone}
            onChange={(e) => u("contactPhone", e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            value={form.notes}
            onChange={(e) => u("notes", e.target.value)}
          />
        </div>

        {/* Voters */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Total Voters
          </label>
          <input
            type="number"
            min="0"
            className="w-full border rounded px-3 py-2"
            value={form.totalVoters}
            onChange={(e) => u("totalVoters", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Male Voters
          </label>
          <input
            type="number"
            min="0"
            className="w-full border rounded px-3 py-2"
            value={form.maleVoters}
            onChange={(e) => u("maleVoters", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Female Voters
          </label>
          <input
            type="number"
            min="0"
            className="w-full border rounded px-3 py-2"
            value={form.femaleVoters}
            onChange={(e) => u("femaleVoters", e.target.value)}
          />
        </div>
      </div>

      {/* ---- Administrative Location ---- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            Administrative Location
          </span>
          <div className="flex items-center gap-1 ml-3">
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "city" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("city")}
              title="City Corporation → City Ward"
            >
              City
            </button>
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "rural" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("rural")}
              title="Upazila → Union → Ward"
            >
              Upazila
            </button>
          </div>
        </div>

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
                disabled={!cityId}
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
                disabled={!upazilaId}
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
                disabled={!unionId}
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

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving
            ? center?._id
              ? "Saving..."
              : "Creating..."
            : center?._id
            ? "Save Changes"
            : "Create Center"}
        </button>

        <button
          type="button"
          className="border px-4 py-2 rounded"
          onClick={() =>
            center?._id
              ? router.push(`/centers/${center._id}`)
              : router.push(`/centers`)
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
