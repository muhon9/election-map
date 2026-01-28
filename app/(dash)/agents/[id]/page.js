// app/(dash)/agents/[id]/page.js
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

function pickImageUrl(agent) {
  const img = agent?.image;
  return img?.thumbnailUrl || img?.url || "";
}

export default function AgentShowPage({ params }) {
  const { id } = params;

  const { data: session } = useSession();
  const canEdit = hasPerm(session, "edit_center");

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const j = await fetchJSON(`/api/agents/${id}`);
        if (!alive) return;
        setAgent(j?.item || null);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr("Failed to load agent");
        setAgent(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const group =
    agent?.agentGroupId && typeof agent.agentGroupId === "object"
      ? agent.agentGroupId
      : null;

  const center =
    group?.center && typeof group.center === "object" ? group.center : null;

  const imgUrl = useMemo(() => pickImageUrl(agent), [agent]);

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Loading agent…
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

  if (!agent) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Agent not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        {/* <div>
          <h1 className="text-xl font-semibold">{agent.name}</h1>
          <div className="text-xs text-gray-500">
            {group?.name ? (
              <>
                Group:{" "}
                <Link
                  href={`/agent-groups/${group._id}`}
                  className="text-blue-600 underline"
                >
                  {group.name}
                </Link>
              </>
            ) : (
              "Group: —"
            )}
            {center?.name ? (
              <>
                {" "}
                • Center:{" "}
                <Link
                  href={`/centers/${center._id}`}
                  className="text-blue-600 underline"
                >
                  {center.name}
                </Link>
              </>
            ) : (
              " • Center: —"
            )}
          </div>
        </div> */}

        <div className="flex items-center gap-2">
          <Link
            href="/agent-groups"
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            ← Agent Groups
          </Link>

          {canEdit && (
            <Link
              href={`/agents/${agent._id}/edit`}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Agent
            </Link>
          )}
        </div>
      </header>

      {/* Top card: image + quick info */}
      {/* Top card: image + quick info */}
      <section className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4">
        {/* Image */}
        <div className="rounded border bg-white p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Agent Photo
          </div>

          <div className="w-full aspect-square rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={agent.name || "agent"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-xs text-gray-400">No photo</div>
            )}
          </div>

          {imgUrl && (
            <a
              href={agent?.image?.url || imgUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-blue-600 underline"
            >
              Open original
            </a>
          )}
        </div>

        {/* Details (bigger text + includes group/center) */}
        <div className="rounded border bg-white p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoBig label="Name" value={agent.name || "—"} />
            <InfoBig label="Area" value={agent.areaName || "—"} />

            <InfoBig
              label="Mobile"
              value={
                agent.mobile ? (
                  <a
                    className="text-blue-600 underline"
                    href={`tel:${agent.mobile}`}
                  >
                    {agent.mobile}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <InfoBig label="NID" value={agent.nid || "—"} />
            <InfoBig
              label="Center"
              value={
                center?.name ? (
                  <Link
                    href={`/centers/${center._id}`}
                    className="text-blue-600 underline"
                  >
                    {center.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <InfoBig
              label="Details"
              value={
                group?.name ? (
                  <Link
                    href={`/agent-groups/${group._id}`}
                    className="text-gray-600 "
                  >
                    {group.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
          </div>

          <div className="pt-3 border-t text-sm text-gray-500">
            Created:{" "}
            {agent.createdAt ? new Date(agent.createdAt).toLocaleString() : "—"}
            {" • "}
            Updated:{" "}
            {agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="text-sm text-gray-800 break-words">{value}</div>
    </div>
  );
}

function InfoBig({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="text-base font-medium text-gray-800 break-words">
        {value}
      </div>
    </div>
  );
}
