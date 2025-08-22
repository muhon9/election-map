"use client";
import { useMemo, useState } from "react";

function badgeColor(n = 0) {
  if (n >= 8) return "bg-red-100 text-red-700 border-red-200";
  if (n >= 5) return "bg-amber-100 text-amber-700 border-amber-200";
  if (n >= 2) return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function CenterAreasPanel({ center }) {
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState("");

  const areas = Array.isArray(center?.areas) ? center.areas : [];

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return areas;
    return areas
      .map((a) => ({
        ...a,
        people: (a.people || []).filter(
          (p) =>
            (p.name || "").toLowerCase().includes(t) ||
            (p.phone || "").toLowerCase().includes(t) ||
            (p.designation || "").toLowerCase().includes(t) ||
            String(p.importance || "").includes(t)
        ),
      }))
      .filter((a) => (a.people || []).length > 0);
  }, [areas, q]);

  return (
    <div className="space-y-3">
      {/* header summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">{areas.length}</span> area
          {areas.length !== 1 ? "s" : ""}
          {areas.length > 0 && (
            <>
              {" • "}
              <span className="font-medium text-gray-800">
                {areas.reduce((sum, a) => sum + (a.people?.length || 0), 0)}
              </span>{" "}
              people
            </>
          )}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people (name, phone, role)…"
          className="w-full sm:w-72 border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* accordion list */}
      <div className="divide-y rounded border overflow-hidden bg-white">
        {filtered.map((a) => {
          const isOpen = openId === String(a._id);
          const people = a.people || [];
          return (
            <div key={a._id}>
              <button
                onClick={() => setOpenId(isOpen ? null : String(a._id))}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {a.name}
                    {a.code ? ` (${a.code})` : ""}
                  </div>
                  <div className="text-xs text-gray-500">
                    {people.length} person{people.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <span className="text-gray-500">{isOpen ? "▴" : "▾"}</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3">
                  {/* table (desktop) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Designation</th>

                          <th className="text-left p-2">Notes</th>
                          <th className="text-left p-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((p) => (
                          <tr key={p._id} className="border-t">
                            <td className="p-2">{p.name}</td>
                            <td className="p-2">{p.designation || "-"}</td>
                            <td className="p-2">{p.notes || "-"}</td>
                            <td className="p-2">
                              {p.phone ? (
                                <a
                                  className="text-blue-600 underline"
                                  href={`tel:${p.phone}`}
                                >
                                  {p.phone}
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
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

                  {/* cards (mobile) */}
                  <div className="md:hidden grid gap-2">
                    {people.length === 0 && (
                      <div className="text-sm text-gray-500">
                        No people yet.
                      </div>
                    )}
                    {people.map((p) => (
                      <div key={p._id} className="border rounded p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {p.designation || "—"}
                            </div>
                          </div>
                          {/* <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${badgeColor(
                              p.importance
                            )}`}
                          >
                            {p.importance ?? 0}
                          </span> */}
                        </div>
                        {p.notes && (
                          <div className="mt-1 text-gray-600">{p.notes}</div>
                        )}
                        <div className="mt-2 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Phone:</span>
                            {p.phone ? (
                              <a
                                className="text-blue-600 underline"
                                href={`tel:${p.phone}`}
                              >
                                {p.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                        {/* <div className="mt-2 flex gap-3 text-sm">
                          <a href="#" className="text-blue-600 underline">
                            Edit
                          </a>
                          <a href="#" className="text-red-600 underline">
                            Delete
                          </a>
                        </div> */}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-3 text-sm text-gray-500">No results.</div>
        )}
      </div>
    </div>
  );
}
