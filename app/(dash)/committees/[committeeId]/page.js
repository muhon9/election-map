// app/(dash)/committees/[committeeId]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function CommitteeShowPage({ params }) {
  const { committeeId } = params;

  const [committee, setCommittee] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!committeeId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [c, p] = await Promise.all([
          fetchJSON(`/api/committees/${committeeId}`),
          fetchJSON(
            `/api/people?committeeId=${committeeId}&category=COMMITTEE&limit=500&sort=order&dir=asc`
          ),
        ]);

        setCommittee(c || null);
        const items = Array.isArray(p?.items)
          ? p.items
          : Array.isArray(p)
          ? p
          : [];
        // Sort locally as safety: by order asc, importance desc, name
        items.sort((a, b) => {
          const ao = a.order ?? 0;
          const bo = b.order ?? 0;
          if (ao !== bo) return ao - bo;
          const ai = a.importance ?? 0;
          const bi = b.importance ?? 0;
          if (ai !== bi) return bi - ai;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
        setPeople(items);
      } catch (e) {
        console.error(e);
        setErr("Failed to load committee details");
      } finally {
        setLoading(false);
      }
    })();
  }, [committeeId]);

  const locationText = useMemo(() => {
    if (!committee) return "";
    const parts = [];

    if (committee.cityId && typeof committee.cityId === "object") {
      parts.push(`City: ${committee.cityId.name}`);
      if (committee.wardId && typeof committee.wardId === "object") {
        parts.push(`Ward: ${committee.wardId.name}`);
      }
    } else if (
      committee.upazillaId &&
      typeof committee.upazillaId === "object"
    ) {
      parts.push(`Upazila: ${committee.upazillaId.name}`);
      if (committee.unionId && typeof committee.unionId === "object") {
        parts.push(`Union: ${committee.unionId.name}`);
      }
      if (committee.wardId && typeof committee.wardId === "object") {
        parts.push(`Ward: ${committee.wardId.name}`);
      }
    }

    if (committee.areaId && typeof committee.areaId === "object") {
      parts.push(`Area: ${committee.areaId.name}`);
    }

    return parts.join(" · ");
  }, [committee]);

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Loading committee…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-red-700">
        {err}
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Committee not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{committee.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/committees"
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            ← Back to Committees
          </Link>
          <Link
            href={`/committees/${committee._id}/edit`}
            className="text-sm px-3 py-1.5 border rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Edit Committee
          </Link>
        </div>
      </header>

      {/* Info cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">
            Administrative Location
          </h2>
          <p className="text-sm text-gray-800">
            {locationText || "Not specified"}
          </p>
        </div>

        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">
            Linked Centers
          </h2>
          {Array.isArray(committee.centers) && committee.centers.length > 0 ? (
            <ul className="text-sm text-gray-800 space-y-1">
              {committee.centers.map((c) => (
                <li key={c._id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-600">
                      {c.address || "—"}
                    </div>
                  </div>
                  <Link
                    href={`/centers/${c._id}`}
                    className="text-xs text-blue-600 underline ml-2"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No centers linked.</p>
          )}
        </div>

        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">Meta</h2>
          <dl className="text-xs text-gray-800 space-y-1">
            <div className="flex justify-between">
              <dt>Created</dt>
              <dd>
                {committee.createdAt
                  ? new Date(committee.createdAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Updated</dt>
              <dd>
                {committee.updatedAt
                  ? new Date(committee.updatedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Attachments */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Attachments</h2>
        {Array.isArray(committee.files) && committee.files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {committee.files.map((f, i) => (
              <div
                key={`${f.url}-${i}`}
                className="border rounded p-3 bg-white flex gap-3"
              >
                <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded bg-gray-50 border">
                  {f.thumbnailUrl || f.mime?.startsWith("image/") ? (
                    <img
                      src={f.thumbnailUrl || f.url}
                      alt={f.filename || "file"}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-500">PDF</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {f.filename || f.url?.split("/").pop()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {f.mime || "file"} ·{" "}
                    {Math.round(Number(f.size || 0) / 1024 || 0)} KB
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No attachments.</p>
        )}
      </section>

      {/* Committee Members */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Committee Members ({people.length})
          </h2>
          <span className="text-xs text-gray-500">
            Source: imported Excel / people linked with this committee
          </span>
        </div>

        <div className="border rounded bg-white overflow-x-auto">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-2 py-1 w-14">Order</th>
                <th className="text-left px-2 py-1">Name</th>
                <th className="text-left px-2 py-1">Position</th>
                <th className="text-left px-2 py-1">Mobile</th>
                <th className="text-left px-2 py-1">Designation</th>
                <th className="text-left px-2 py-1 w-20">Importance</th>
              </tr>
            </thead>
            <tbody>
              {people.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-3 text-sm text-gray-500 text-center"
                  >
                    No members linked to this committee yet.
                  </td>
                </tr>
              ) : (
                people.map((p) => (
                  <tr key={p._id} className="border-t hover:bg-gray-50">
                    <td className="px-2 py-1 text-xs">{p.order ?? 0}</td>
                    <td className="px-2 py-1 font-medium">{p.name}</td>
                    <td className="px-2 py-1 text-xs">{p.position || "—"}</td>
                    <td className="px-2 py-1 text-xs font-mono">
                      {p.phone || "—"}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {p.designation || "—"}
                    </td>
                    <td className="px-2 py-1 text-xs">{p.importance ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
