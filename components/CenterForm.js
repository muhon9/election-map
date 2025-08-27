"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CenterForm({ center = null, onSaved }) {
  const router = useRouter();

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

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    // Prepare payload; keep lat/lng & counts numeric
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

      // Call optional callback then route
      if (onSaved) onSaved(data);
      if (!center?._id) {
        // after create go to edit page
        router.push(`/centers/${data._id}`);
      } else {
        // after edit, refresh page data
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
