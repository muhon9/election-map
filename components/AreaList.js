"use client";
import { useState } from "react";

export default function AreaList({ centerId, initialAreas = [] }) {
  const [areas, setAreas] = useState(initialAreas);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function addArea(e) {
    e.preventDefault();
    const res = await fetch(`/api/centers/${centerId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    const data = await res.json();
    if (res.ok) {
      setAreas((a) => [...a, data]);
      setName("");
      setCode("");
    } else {
      alert(data.error || "Failed");
    }
  }

  async function removeArea(id) {
    if (!confirm("Delete this area?")) return;
    const res = await fetch(`/api/centers/${centerId}/areas/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setAreas((a) => a.filter((x) => x._id !== id));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={addArea} className="flex gap-2">
        <input
          className="border px-3 py-2 rounded w-48"
          placeholder="Area name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border px-3 py-2 rounded w-32"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 py-2 rounded">
          Add area
        </button>
      </form>

      <div className="space-y-2">
        {areas.map((a) => (
          <AreaCard
            key={a._id}
            centerId={centerId}
            area={a}
            onDelete={removeArea}
          />
        ))}
        {!areas.length && (
          <p className="text-sm text-gray-500">No areas yet.</p>
        )}
      </div>
    </div>
  );
}

function AreaCard({ centerId, area, onDelete }) {
  const [people, setPeople] = useState(area.people || []);
  const [p, setP] = useState({
    name: "",
    phone: "",
    designation: "",
    importance: 0,
    notes: "",
  });

  async function addPerson(e) {
    e.preventDefault();
    const res = await fetch(
      `/api/centers/${centerId}/areas/${area._id}/people`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      }
    );
    const data = await res.json();
    if (res.ok) {
      // re-fetch people list for correctness (or optimistically push)
      const r = await fetch(
        `/api/centers/${centerId}/areas/${area._id}/people`
      );
      const list = await r.json();
      setPeople(list);
      setP({ name: "", phone: "", designation: "", importance: 0, notes: "" });
    } else {
      alert(data.error || "Failed");
    }
  }

  return (
    <div className="border rounded p-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          {area.name}
          {area.code ? ` (${area.code})` : ""}
        </div>
        <button
          className="text-red-600 text-sm"
          onClick={() => onDelete(area._id)}
        >
          Delete
        </button>
      </div>

      <div className="mt-2 text-sm">
        <div className="font-medium mb-1">People</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-1">Name</th>
                <th className="text-left p-1">Phone</th>
                <th className="text-left p-1">Designation</th>

                <th className="text-left p-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {people.map((pp) => (
                <tr key={pp._id} className="border-t">
                  <td className="p-1">{pp.name}</td>
                  <td className="p-1">{pp.phone || "-"}</td>
                  <td className="p-1">{pp.designation || "-"}</td>
                  <td className="p-1">{pp.notes || "-"}</td>
                </tr>
              ))}
              {!people.length && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={5}>
                    No people yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={addPerson} className="mt-3 grid grid-cols-5 gap-2">
          <input
            className="border px-2 py-1 rounded col-span-1"
            placeholder="Name"
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            required
          />
          <input
            className="border px-2 py-1 rounded col-span-1"
            placeholder="Phone"
            value={p.phone}
            onChange={(e) => setP({ ...p, phone: e.target.value })}
          />
          <input
            className="border px-2 py-1 rounded col-span-1"
            placeholder="Designation"
            value={p.designation}
            onChange={(e) => setP({ ...p, designation: e.target.value })}
          />
          <input
            className="border px-2 py-1 rounded col-span-1"
            type="number"
            min="0"
            max="10"
            placeholder="Importance"
            value={p.importance}
            onChange={(e) => setP({ ...p, importance: e.target.value })}
          />
          <input
            className="border px-2 py-1 rounded col-span-5 md:col-span-3"
            placeholder="Notes"
            value={p.notes}
            onChange={(e) => setP({ ...p, notes: e.target.value })}
          />
          <button className="bg-green-600 text-white px-3 py-1.5 rounded col-span-5 md:col-span-2">
            Add person
          </button>
        </form>
      </div>
    </div>
  );
}
