"use client";
import { useEffect, useState } from "react";

export default function AreasEditor({ centerId, initialAreas = [] }) {
  const [areas, setAreas] = useState(initialAreas);
  const [adding, setAdding] = useState({ name: "", code: "" });
  const [busy, setBusy] = useState(false);

  // (Optional) refetch from server when mounted to ensure freshest data
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/centers/${centerId}/areas`);
      if (res.ok) {
        const data = await res.json();
        setAreas(Array.isArray(data) ? data : []);
      }
    })();
  }, [centerId]);

  async function addArea(e) {
    e.preventDefault();
    if (!adding.name.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/centers/${centerId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding),
    });
    setBusy(false);
    const data = await res.json();
    if (res.ok) {
      setAreas((a) => [...a, data]);
      setAdding({ name: "", code: "" });
    } else {
      alert(data?.error || "Failed to add area");
    }
  }

  async function deleteArea(areaId) {
    if (!confirm("Delete this area?")) return;
    const res = await fetch(`/api/centers/${centerId}/areas/${areaId}`, {
      method: "DELETE",
    });
    if (res.ok) setAreas((a) => a.filter((x) => x._id !== areaId));
    else alert("Failed to delete area");
  }

  function onAreaEdited(local) {
    setAreas((prev) => prev.map((a) => (a._id === local._id ? local : a)));
  }

  function onPeopleChanged(areaId, newPeople) {
    setAreas((prev) =>
      prev.map((a) => (a._id === areaId ? { ...a, people: newPeople } : a))
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Areas</h2>

      {/* Add Area */}
      <form onSubmit={addArea} className="flex flex-col sm:flex-row gap-2">
        <input
          className="border px-3 py-2 rounded sm:w-64"
          placeholder="Area name"
          value={adding.name}
          onChange={(e) => setAdding((s) => ({ ...s, name: e.target.value }))}
          required
        />
        <input
          className="border px-3 py-2 rounded sm:w-40"
          placeholder="Code"
          value={adding.code}
          onChange={(e) => setAdding((s) => ({ ...s, code: e.target.value }))}
        />
        <button
          disabled={busy}
          className="bg-blue-600 text-white px-3 py-2 rounded"
        >
          {busy ? "Adding..." : "Add area"}
        </button>
      </form>

      {/* Areas list */}
      <div className="space-y-2">
        {areas.map((a) => (
          <AreaRow
            key={a._id}
            centerId={centerId}
            area={a}
            onDelete={deleteArea}
            onEdited={onAreaEdited}
            onPeopleChanged={onPeopleChanged}
          />
        ))}
        {!areas.length && (
          <p className="text-sm text-gray-500">No areas yet.</p>
        )}
      </div>
    </div>
  );
}

function AreaRow({ centerId, area, onDelete, onEdited, onPeopleChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: area.name || "",
    code: area.code || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setErr("");
    setSaving(true);
    const res = await fetch(`/api/centers/${centerId}/areas/${area._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, code: form.code }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error || "Failed to save");
      return;
    }
    onEdited({ ...area, name: form.name, code: form.code });
    setEditing(false);
  }

  function cancel() {
    setErr("");
    setForm({ name: area.name || "", code: area.code || "" });
    setEditing(false);
  }

  return (
    <div className="border rounded p-3 bg-white">
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {area.name}
              {area.code ? ` (${area.code})` : ""}
            </div>
            <div className="text-xs text-gray-500">
              {area.people?.length || 0} people
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="text-blue-600 text-sm underline"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="text-red-600 text-sm underline"
              onClick={() => onDelete(area._id)}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="border px-3 py-2 rounded col-span-2"
              placeholder="Area name"
              value={form.name}
              onChange={(e) => u("name", e.target.value)}
              required
            />
            <input
              className="border px-3 py-2 rounded"
              placeholder="Code"
              value={form.code}
              onChange={(e) => u("code", e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-green-600 text-white px-3 py-2 rounded disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-3 py-2 border rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* People editor under the area */}
      <PeopleEditor
        centerId={centerId}
        areaId={area._id}
        initialPeople={area.people || []}
        onPeopleChanged={(list) => onPeopleChanged(area._id, list)}
      />
    </div>
  );
}

function PeopleEditor({ centerId, areaId, initialPeople }) {
  const [people, setPeople] = useState(initialPeople);
  const [p, setP] = useState({
    name: "",
    phone: "",
    designation: "",
    importance: 0,
    notes: "",
  });
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/centers/${centerId}/areas/${areaId}/people`);
    if (res.ok) {
      const list = await res.json();
      setPeople(Array.isArray(list) ? list : []);
    }
  }

  async function addPerson(e) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch(`/api/centers/${centerId}/areas/${areaId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setAdding(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Failed to add person");
      return;
    }
    setP({ name: "", phone: "", designation: "", importance: 0, notes: "" });
    await refresh();
  }

  async function deletePerson(personId) {
    if (!confirm("Delete this person?")) return;
    const res = await fetch(
      `/api/centers/${centerId}/areas/${areaId}/people/${personId}`,
      {
        method: "DELETE",
      }
    );
    if (res.ok) await refresh();
    else alert("Failed to delete person");
  }

  function onPersonEdited(local) {
    setPeople((prev) => prev.map((x) => (x._id === local._id ? local : x)));
  }

  return (
    <div className="mt-3">
      <div className="font-medium text-sm mb-2">People</div>

      {/* Add person */}
      <form
        onSubmit={addPerson}
        className="grid grid-cols-1 md:grid-cols-6 gap-2"
      >
        <input
          className="border px-2 py-2 rounded md:col-span-2"
          placeholder="Name"
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          required
        />
        <input
          className="border px-2 py-2 rounded"
          placeholder="Phone"
          value={p.phone}
          onChange={(e) => setP({ ...p, phone: e.target.value })}
        />
        <input
          className="border px-2 py-2 rounded"
          placeholder="Designation"
          value={p.designation}
          onChange={(e) => setP({ ...p, designation: e.target.value })}
        />

        <input
          className="border px-2 py-2 rounded md:col-span-2"
          placeholder="Notes"
          value={p.notes}
          onChange={(e) => setP({ ...p, notes: e.target.value })}
        />
        <button className="bg-green-600 text-white px-3 py-2 rounded md:col-span-1">
          {adding ? "Adding..." : "Add"}
        </button>
      </form>

      {/* People list (inline editable rows) */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Designation</th>

              <th className="text-left p-2">Notes</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => (
              <PersonRow
                key={row._id}
                centerId={centerId}
                areaId={areaId}
                person={row}
                onEdited={onPersonEdited}
                onDelete={deletePerson}
              />
            ))}
            {!people.length && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  No people yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonRow({ centerId, areaId, person, onEdited, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: person.name || "",
    phone: person.phone || "",
    designation: person.designation || "",
    importance: person.importance ?? 0,
    notes: person.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setErr("");
    setSaving(true);
    const res = await fetch(
      `/api/centers/${centerId}/areas/${areaId}/people/${person._id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error || "Failed to save");
      return;
    }
    onEdited({ ...person, ...form });
    setEdit(false);
  }

  function cancel() {
    setErr("");
    setForm({
      name: person.name || "",
      phone: person.phone || "",
      designation: person.designation || "",
      importance: person.importance ?? 0,
      notes: person.notes || "",
    });
    setEdit(false);
  }

  return (
    <tr className="border-t align-top">
      {!edit ? (
        <>
          <td className="p-2">{person.name}</td>
          <td className="p-2">
            {person.phone ? (
              <a
                className="text-blue-600 underline"
                href={`tel:${person.phone}`}
              >
                {person.phone}
              </a>
            ) : (
              "—"
            )}
          </td>
          <td className="p-2">{person.designation || "—"}</td>

          <td className="p-2">{person.notes || "—"}</td>
          <td className="p-2">
            <button
              className="text-blue-600 underline mr-2"
              onClick={() => setEdit(true)}
            >
              Edit
            </button>
            <button
              className="text-red-600 underline"
              onClick={() => onDelete(person._id)}
            >
              Delete
            </button>
          </td>
        </>
      ) : (
        <td colSpan={6} className="p-2">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              className="border px-2 py-1 rounded md:col-span-2"
              value={form.name}
              onChange={(e) => u("name", e.target.value)}
            />
            <input
              className="border px-2 py-1 rounded"
              value={form.phone}
              onChange={(e) => u("phone", e.target.value)}
            />
            <input
              className="border px-2 py-1 rounded"
              value={form.designation}
              onChange={(e) => u("designation", e.target.value)}
            />

            <input
              className="border px-2 py-1 rounded md:col-span-2"
              value={form.notes}
              onChange={(e) => u("notes", e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-green-600 text-white px-3 py-1.5 rounded disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 border rounded">
              Cancel
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
