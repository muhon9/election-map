// components/PersonEditForm.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PersonEditForm({ person }) {
  const router = useRouter();
  console.log("person", person);
  // normalise populated refs so we don't accidentally render whole objects
  const committee =
    person.committeeId && typeof person.committeeId === "object"
      ? person.committeeId
      : null;

  const area =
    person.area && typeof person.area === "object" ? person.area : null;

  const center =
    person.center && typeof person.center === "object" ? person.center : null;

  const [form, setForm] = useState({
    name: person.name || "",
    phone: person.phone || person.mobile || "",
    whatsapp: person.whatsapp || "",
    email: person.email || "",
    designation: person.designation || "",
    position: person.position || "",
    order:
      typeof person.order === "number"
        ? String(person.order)
        : person.order || "",
    importance:
      typeof person.importance === "number"
        ? String(person.importance)
        : person.importance || "",
    notes: person.notes || "",
    isFavorite: !!person.isFavorite,
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function u(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    const payload = {
      name: (form.name || "").trim(),
      phone: (form.phone || "").trim(),
      whatsapp: (form.whatsapp || "").trim(),
      email: (form.email || "").trim(),
      designation: (form.designation || "").trim(),
      position: (form.position || "").trim(),
      notes: (form.notes || "").trim(),
      isFavorite: !!form.isFavorite,
    };

    if (form.order !== "") {
      const n = Number(form.order);
      if (!Number.isNaN(n)) payload.order = n;
    }

    if (form.importance !== "") {
      const n = Number(form.importance);
      if (!Number.isNaN(n)) payload.importance = n;
    }

    if (!payload.name) {
      setSaving(false);
      setErr("Name is required");
      return;
    }

    try {
      const res = await fetch(`/api/people/${person._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaving(false);
        setErr(j?.error || "Failed to save person");
        return;
      }

      // On success: go back to committee page if available, otherwise /people
      if (committee && committee._id) {
        router.push(`/committees/${committee._id}`);
      } else {
        router.push("/people");
      }
    } catch (e) {
      console.error(e);
      setSaving(false);
      setErr("Network error");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded border bg-white p-4 space-y-5 max-w-2xl"
    >
      {/* Context info (read-only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700">
        <div className="border rounded p-2 bg-gray-50">
          <div className="font-semibold mb-1">Category</div>
          <div>{person.category || "—"}</div>
        </div>
        <div className="border rounded p-2 bg-gray-50">
          <div className="font-semibold mb-1">Committee</div>
          <div>{committee?.name || "—"}</div>
        </div>
        {/* <div className="border rounded p-2 bg-gray-50">
          <div className="font-semibold mb-1">Area / Center</div>
          <div>
            {committee?.areas[0]?.name || committee?.centers[0]?.name || "—"}
          </div>
        </div> */}
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => u("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Mobile
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.phone}
            onChange={(e) => u("phone", e.target.value)}
            placeholder="01xxxxxxxxx"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            WhatsApp
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.whatsapp}
            onChange={(e) => u("whatsapp", e.target.value)}
            placeholder="(optional, can be same as mobile)"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={form.email}
            onChange={(e) => u("email", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Designation (e.g. Councillor)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.designation}
            onChange={(e) => u("designation", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Committee Position (e.g. President)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.position}
            onChange={(e) => u("position", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Order (for sorting)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.order}
            onChange={(e) => u("order", e.target.value)}
            placeholder="0, 1, 2…"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Importance
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.importance}
            onChange={(e) => u("importance", e.target.value)}
            placeholder="0–999"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          rows={3}
          className="w-full border rounded px-3 py-2"
          value={form.notes}
          onChange={(e) => u("notes", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isFavorite"
          type="checkbox"
          className="h-4 w-4"
          checked={form.isFavorite}
          onChange={(e) => u("isFavorite", e.target.checked)}
        />
        <label
          htmlFor="isFavorite"
          className="text-xs font-medium text-gray-700"
        >
          Mark as favorite / key contact
        </label>
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
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          className="border px-4 py-2 rounded"
          onClick={() => {
            if (committee && committee._id) {
              router.push(`/committees/${committee._id}`);
            } else {
              router.push("/people");
            }
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
