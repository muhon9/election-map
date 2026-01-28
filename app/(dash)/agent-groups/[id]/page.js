// app/(dash)/agent-groups/[id]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPerm } from "@/lib/rbac";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AgentGroupShowPage({ params }) {
  const { id } = params;

  const [group, setGroup] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const canEdit = hasPerm(useSession()?.data, "edit_center");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // group info + agents list
        const [g, a] = await Promise.all([
          fetchJSON(`/api/agent-groups/${id}`),
          fetchJSON(`/api/agents?groupId=${id}&limit=500&sort=order&dir=asc`),
        ]);

        setGroup(g || null);

        const items = Array.isArray(a?.items)
          ? a.items
          : Array.isArray(a)
            ? a
            : [];

        // Sort locally as safety
        items.sort((x, y) => {
          const xo = x.order ?? 0;
          const yo = y.order ?? 0;
          if (xo !== yo) return xo - yo;
          return String(x.name || "").localeCompare(String(y.name || ""));
        });

        setAgents(items);
      } catch (e) {
        console.error(e);
        setErr("Failed to load agent group details");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const centerText = useMemo(() => {
    if (!group?.center) return "";
    if (typeof group.center === "object") return group.center.name || "";
    return String(group.center || "");
  }, [group]);

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Loading agent group…
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

  if (!group) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Agent group not found.
      </div>
    );
  }

  const centerObj =
    group.center && typeof group.center === "object" ? group.center : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/agent-groups"
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            ← Back to Agent Groups
          </Link>
          {canEdit && (
            <Link
              href={`/agent-groups/${group._id}/edit`}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Agent Group
            </Link>
          )}
        </div>
      </header>

      {/* Info cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">
            Linked Center
          </h2>

          {centerObj ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {centerObj.name || "—"}
                </div>
                <div className="text-xs text-gray-600">
                  {centerObj.address || "—"}
                </div>
              </div>
              <Link
                href={`/centers/${centerObj._id}`}
                className="text-xs text-blue-600 underline"
              >
                Open
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {centerText || "Not linked"}
            </p>
          )}
        </div>

        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">
            Total Agents
          </h2>
          <p className="text-sm text-gray-800">{agents.length}</p>
        </div>

        <div className="border rounded bg-white p-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">
            Last Updated
          </h2>
          <p className="text-sm text-gray-800">
            {group.updatedAt ? new Date(group.updatedAt).toLocaleString() : "—"}
          </p>
        </div>
      </section>

      {/* Agents table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Agents ({agents.length})</h2>
        </div>

        <div className="border rounded bg-white overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                {/* <th className="text-left px-2 py-2 w-16">Order</th> */}
                <th className="text-left px-2 py-2 w-20">Photo</th>
                <th className="text-left px-2 py-2">Name</th>
                <th className="text-left px-2 py-2">Area</th>
                <th className="text-left px-2 py-2">Mobile</th>
                <th className="text-left px-2 py-2">NID</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-sm text-gray-500 text-center"
                  >
                    No agents found in this group.
                  </td>
                </tr>
              ) : (
                agents.map((a) => {
                  const img =
                    a.image?.url ||
                    a.photo?.url ||
                    a.photoUrl ||
                    a.imageUrl ||
                    "";

                  const phone = a.mobile || a.phone || "";
                  const nid = a.nid || a.nidNumber || a.NID || "";

                  return (
                    <tr key={a._id} className="border-t hover:bg-gray-50">
                      {/* <td className="px-2 py-2 text-xs">{a.order ?? 0}</td> */}

                      <td className="px-2 py-2">
                        <div className="w-12 h-12 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                          {img ? (
                            <img
                              src={img}
                              alt={a.name || "agent"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2 text-lg font-medium text-gray-800">
                        <Link
                          href={`/agents/${a._id}`}
                          className="hover:underline"
                        >
                          {a.name || "—"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-xs">{a.area || "—"}</td>

                      <td className="px-2 py-2 text-xs font-mono">
                        {phone ? (
                          <a href={`tel:${phone}`} className="text-blue-600">
                            {phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-2 py-2 text-xs font-mono">
                        {nid || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
