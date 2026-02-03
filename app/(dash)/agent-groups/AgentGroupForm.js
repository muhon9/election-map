"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AgentGroupForm({ agentGroup = null, onSaved }) {
  const router = useRouter();

  const [name, setName] = useState(agentGroup?.name || "");
  const [center, setCenter] = useState(
    agentGroup?.center
      ? { _id: agentGroup.center._id, name: agentGroup.center.name }
      : null,
  );

  // doc link state
  const [docLink, setDocLink] = useState(agentGroup?.docLink || "");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // ---------- Center search ----------
  const [centerSearch, setCenterSearch] = useState("");
  const [centerOpts, setCenterOpts] = useState([]);
  const timer = useRef(null);

  function doCenterSearch(term) {
    const q = term ? `?q=${encodeURIComponent(term)}&limit=10` : `?limit=10`;
    fetchJSON(`/api/centers${q}`)
      .then((j) => setCenterOpts(j.items || []))
      .catch(() => setCenterOpts([]));
  }

  function onCenterInput(e) {
    const v = e.target.value;
    setCenterSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doCenterSearch(v), 300);
  }

  function selectCenter(c) {
    setCenter({ _id: c._id, name: c.name });
    setCenterSearch("");
    setCenterOpts([]);
  }

  function clearCenter() {
    setCenter(null);
  }

  // ---------- Submit ----------
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!name.trim()) {
      setErr("Agent group name is required");
      return;
    }
    if (!center?._id) {
      setErr("Center is required");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        centerId: center._id,
        docLink: docLink.trim(),
      };

      const url = agentGroup?._id
        ? `/api/agent-groups/${agentGroup._id}`
        : `/api/agent-groups`;

      const method = agentGroup?._id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      setSaving(false);

      if (!res.ok) {
        setErr(j?.error || "Failed to save agent group");
        return;
      }

      onSaved?.(j.item || j);

      if (agentGroup?._id) {
        router.refresh();
      } else {
        router.push(`/agent-groups/${j.item?._id || j._id}`);
      }
    } catch (e) {
      console.error(e);
      setSaving(false);
      setErr("Network error");
    }
  }

  // ---------- UI ----------
  return (
    <form onSubmit={onSubmit} className="rounded border bg-white p-4 space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Agent Group Name
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sylhet Govt Alia Madrasa – Male Booth"
          required
        />
      </div>

      {/* Center */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">
          Center
        </label>

        {!center && (
          <>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Search center…"
              value={centerSearch}
              onChange={onCenterInput}
            />

            {centerOpts.length > 0 && (
              <div className="border rounded bg-white max-h-56 overflow-auto">
                {centerOpts.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => selectCenter(c)}
                  >
                    <div className="font-medium">{c.name}</div>
                    {c.address && (
                      <div className="text-xs text-gray-500 truncate">
                        {c.address}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {center && (
          <div className="inline-flex items-center gap-2 border rounded px-3 py-2 bg-gray-50">
            <span className="font-medium">{center.name}</span>
            <button
              type="button"
              className="text-red-600 text-sm"
              onClick={clearCenter}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Doc Link */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Document Link
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          value={docLink}
          onChange={(e) => setDocLink(e.target.value)}
          placeholder="https://example.com/document"
        />
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving
            ? agentGroup?._id
              ? "Saving…"
              : "Creating…"
            : agentGroup?._id
              ? "Save Changes"
              : "Create Agent Group"}
        </button>

        <button
          type="button"
          className="border px-4 py-2 rounded"
          onClick={() =>
            agentGroup?._id
              ? router.push(`/agent-groups/${agentGroup._id}`)
              : router.push(`/agent-groups`)
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
