"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPerm } from "@/lib/rbac";
import UploaderMini from "@/components/UploaderMini";

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { cache: "no-store", ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || (await r.text()) || "Request failed");
  return j;
}

export default function AgentGroupEditPage({ params }) {
  const router = useRouter();
  const { data: session } = useSession();

  const groupId = params?.id;

  const canEdit = hasPerm(session, "edit_center");
  const canDelete = hasPerm(session, "delete_center");

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // -------- group edit fields --------
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [centerSearch, setCenterSearch] = useState("");
  const [centerOpts, setCenterOpts] = useState([]);
  const [center, setCenter] = useState(null); // { _id, name }

  const centerTimer = useRef(null);

  function doCenterSearch(term) {
    const qs = term?.trim()
      ? `?q=${encodeURIComponent(term.trim())}&limit=10`
      : `?limit=10`;
    fetchJSON(`/api/centers${qs}`)
      .then((j) => setCenterOpts(j.items || []))
      .catch(() => setCenterOpts([]));
  }

  function onCenterInput(e) {
    const v = e.target.value;
    setCenterSearch(v);
    if (centerTimer.current) clearTimeout(centerTimer.current);
    centerTimer.current = setTimeout(() => doCenterSearch(v), 250);
  }

  // Load group
  useEffect(() => {
    if (!groupId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const g = await fetchJSON(`/api/agent-groups/${groupId}`);
        if (!alive) return;

        setGroup(g);
        setName(g?.name || "");
        setNotes(g?.notes || "");
        setCenter(
          g?.center && typeof g.center === "object"
            ? { _id: g.center._id, name: g.center.name || "" }
            : null,
        );
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr("Failed to load agent group");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupId]);

  // Save group
  const [saving, setSaving] = useState(false);

  async function saveGroup(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      name: (name || "").trim(),
      notes: notes || "",
      centerId: center?._id || null,
    };

    if (!payload.name) {
      setErr("Agent group name is required");
      return;
    }

    try {
      setSaving(true);
      setErr("");
      const j = await fetchJSON(`/api/agent-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // API returns { ok, item }
      const updated = j?.item || null;
      if (updated) {
        setGroup(updated);
        setName(updated.name || "");
        setNotes(updated.notes || "");
        setCenter(
          updated?.center && typeof updated.center === "object"
            ? { _id: updated.center._id, name: updated.center.name || "" }
            : null,
        );
      }

      router.refresh();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save agent group");
    } finally {
      setSaving(false);
    }
  }

  // -------- agents list --------
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsErr, setAgentsErr] = useState("");

  async function loadAgents() {
    if (!groupId) return;
    setAgentsLoading(true);
    setAgentsErr("");
    try {
      const j = await fetchJSON(
        `/api/agents?groupId=${encodeURIComponent(groupId)}&limit=500&sort=order&dir=asc`,
      );
      const items = Array.isArray(j.items)
        ? j.items
        : Array.isArray(j)
          ? j
          : [];
      setAgents(items);
    } catch (e) {
      console.error(e);
      setAgents([]);
      setAgentsErr(e.message || "Failed to load agents");
    } finally {
      setAgentsLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // -------- add agent form --------
  const [newAgent, setNewAgent] = useState({
    order: "",
    name: "",
    area: "",
    mobile: "",
    nid: "",
    photoUrl: "",
  });
  const [adding, setAdding] = useState(false);

  function ua(k, v) {
    setNewAgent((s) => ({ ...s, [k]: v }));
  }

  function onAgentPhotoDone(files) {
    const f = Array.isArray(files) ? files[0] : null;
    if (!f?.url) return;
    ua("photoUrl", f.url);
  }

  async function addAgent(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      groupId,
      order:
        newAgent.order === "" || newAgent.order === null
          ? 0
          : Number(newAgent.order),
      name: (newAgent.name || "").trim(),
      area: (newAgent.area || "").trim(),
      mobile: (newAgent.mobile || "").trim(),
      nid: (newAgent.nid || "").trim(),
      photoUrl: newAgent.photoUrl || "",
    };

    if (!payload.name) {
      alert("Agent name is required");
      return;
    }

    try {
      setAdding(true);
      const j = await fetchJSON(`/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // assumes { ok, item }
      const item = j?.item || j;
      setAgents((prev) => {
        const next = [item, ...prev];
        next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return next;
      });

      setNewAgent({
        order: "",
        name: "",
        area: "",
        mobile: "",
        nid: "",
        photoUrl: "",
      });
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to add agent");
    } finally {
      setAdding(false);
    }
  }

  // -------- delete / bulk delete --------
  const [selectedIds, setSelectedIds] = useState([]);

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === agents.length) setSelectedIds([]);
    else setSelectedIds(agents.map((a) => a._id));
  }

  async function deleteOne(id) {
    if (!canDelete) return;
    if (!confirm("Delete this agent?")) return;

    try {
      const r = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to delete agent");
      setAgents((prev) => prev.filter((a) => a._id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to delete agent");
    }
  }

  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function deleteSelected() {
    if (!canDelete) return;
    if (!selectedIds.length) return alert("No agents selected");
    if (
      !confirm(`Delete ${selectedIds.length} agent(s)? This cannot be undone.`)
    )
      return;

    setBulkDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/agents/${id}`, { method: "DELETE" }),
        ),
      );
      setAgents((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
      setSelectedIds([]);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete some agents. Refresh and try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  // -------- Excel import (dry-run + confirm) --------
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  async function onImportChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportErr("");
    setImportResult(null);
    setPendingFile(null);
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        `/api/agent-groups/${groupId}/import-agents?dry=1`,
        {
          method: "POST",
          body: fd,
        },
      );

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setImportErr(j?.error || "Failed to run dry-run import");
      } else {
        setImportResult(j);
        setPendingFile(file);
      }
    } catch (e2) {
      console.error(e2);
      setImportErr("Network error during import");
    } finally {
      setImporting(false);
      if (e.target) e.target.value = "";
    }
  }

  async function confirmImport() {
    if (!pendingFile) return alert("No file ready. Choose a file again.");

    setImporting(true);
    setImportErr("");
    try {
      const fd = new FormData();
      fd.append("file", pendingFile);

      const res = await fetch(`/api/agent-groups/${groupId}/import-agents`, {
        method: "POST",
        body: fd,
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setImportErr(j?.error || "Failed to import agents");
      } else {
        setImportResult(j);
        setPendingFile(null);
        await loadAgents();
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setImportErr("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  const centerLabel = useMemo(() => {
    if (!group?.center) return "—";
    if (typeof group.center === "object") return group.center.name || "—";
    return String(group.center);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Edit Agent Group</h1>
          <div className="text-xs text-gray-600 mt-1">
            Group: <span className="font-medium">{group.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/agent-groups/${groupId}`}
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Group edit card */}
      <form
        onSubmit={saveGroup}
        className="rounded border bg-white p-4 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Agent Group Name
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Linked Center
            </label>

            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Search center..."
              value={centerSearch}
              onChange={onCenterInput}
              disabled={!canEdit}
            />

            {centerOpts.length > 0 && (
              <div className="border rounded mt-2 p-2 max-h-48 overflow-auto bg-white">
                {centerOpts.map((c) => {
                  const active = String(center?._id) === String(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      className={`w-full text-left px-2 py-1 rounded hover:bg-gray-50 ${
                        active ? "bg-blue-50" : ""
                      }`}
                      onClick={() => {
                        setCenter({ _id: c._id, name: c.name || "" });
                        setCenterSearch(c.name || "");
                        setCenterOpts([]);
                      }}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-600">
                        {c.address || "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 text-xs text-gray-600">
              Current:{" "}
              {center?._id ? (
                <span className="font-medium">{center.name || center._id}</span>
              ) : (
                <span className="font-medium">{centerLabel}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ml-2 text-red-600 hover:underline"
                  onClick={() => setCenter(null)}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!canEdit || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Group"}
          </button>

          {group?.center?._id && (
            <Link
              href={`/centers/${group.center._id}`}
              className="text-sm px-3 py-2 border rounded hover:bg-gray-50"
            >
              Open Center
            </Link>
          )}
        </div>
      </form>

      {/* Add agent */}
      <form
        onSubmit={addAgent}
        className="rounded border bg-white p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add Agent</h2>
          <div className="text-xs text-gray-600">
            {agentsLoading ? "Loading agents…" : `${agents.length} agents`}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Serial (order)
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={newAgent.order}
              onChange={(e) => ua("order", e.target.value)}
              placeholder="1"
              inputMode="numeric"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Agent Name
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={newAgent.name}
              onChange={(e) => ua("name", e.target.value)}
              placeholder="Name"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Area Name
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={newAgent.area}
              onChange={(e) => ua("area", e.target.value)}
              placeholder="Area"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Photo
            </label>
            <div className="flex items-center gap-2">
              <UploaderMini onDone={onAgentPhotoDone} />
              {newAgent.photoUrl ? (
                <img
                  src={newAgent.photoUrl}
                  alt="agent"
                  className="w-10 h-10 rounded object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded border bg-gray-50" />
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mobile
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={newAgent.mobile}
              onChange={(e) => ua("mobile", e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              NID
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={newAgent.nid}
              onChange={(e) => ua("nid", e.target.value)}
              placeholder="NID number"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!canEdit || adding}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add Agent"}
          </button>
          <button
            type="button"
            className="px-4 py-2 border rounded hover:bg-gray-50"
            onClick={() =>
              setNewAgent({
                order: "",
                name: "",
                area: "",
                mobile: "",
                nid: "",
                photoUrl: "",
              })
            }
          >
            Clear
          </button>
        </div>
      </form>

      {/* Excel import */}
      <div className="rounded border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">
          Bulk Import Agents (Excel/CSV)
        </h2>
        <p className="text-xs text-gray-600">
          Columns supported (recommended):{" "}
          <span className="font-mono">order</span>,{" "}
          <span className="font-mono">name</span>,{" "}
          <span className="font-mono">area</span>,{" "}
          <span className="font-mono">mobile</span>,{" "}
          <span className="font-mono">nid</span>,{" "}
          <span className="font-mono">photoUrl</span>
        </p>

        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onImportChange}
            disabled={importing || !canEdit}
            className="text-sm"
          />
          {importing && (
            <span className="text-xs text-gray-600">Processing…</span>
          )}
        </div>

        {importErr && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {importErr}
          </div>
        )}

        {importResult && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 space-y-1">
            <div className="font-medium">
              {importResult.dryRun ? "Dry-run summary" : "Import summary"}
            </div>
            {"inserted" in importResult && (
              <div>Inserted: {importResult.inserted}</div>
            )}
            {"updated" in importResult && (
              <div>Updated: {importResult.updated}</div>
            )}
            {"skipped" in importResult && (
              <div>Skipped: {importResult.skipped}</div>
            )}

            {Array.isArray(importResult.errors) &&
              importResult.errors.length > 0 && (
                <div>
                  Errors: {importResult.errors.length} (first few)
                  <ul className="list-disc ml-4 mt-1">
                    {importResult.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                  </ul>
                </div>
              )}

            {importResult.dryRun && pendingFile && (
              <div className="pt-2">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-1.5 rounded border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                  onClick={confirmImport}
                  disabled={importing}
                >
                  Confirm import
                </button>
                <span className="ml-2 text-[11px] text-emerald-900/80">
                  This will apply changes to the database.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agents table */}
      <div className="rounded border bg-white overflow-x-auto">
        <div className="p-3 border-b flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Agents</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
              onClick={loadAgents}
              disabled={agentsLoading}
            >
              Refresh
            </button>

            {canDelete && (
              <button
                type="button"
                className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-60"
                onClick={deleteSelected}
                disabled={bulkDeleting || selectedIds.length === 0}
              >
                {bulkDeleting
                  ? "Deleting…"
                  : `Delete selected (${selectedIds.length})`}
              </button>
            )}
          </div>
        </div>

        {agentsErr && (
          <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b">
            {agentsErr}
          </div>
        )}

        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left w-10">
                <input
                  type="checkbox"
                  checked={
                    agents.length > 0 && selectedIds.length === agents.length
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-2 text-left w-16">Photo</th>
              <th className="p-2 text-left w-16">Order</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Area</th>
              <th className="p-2 text-left">Mobile</th>
              <th className="p-2 text-left">NID</th>
              <th className="p-2 text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agentsLoading && (
              <tr>
                <td colSpan={8} className="p-3 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!agentsLoading && agents.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-gray-500">
                  No agents added yet.
                </td>
              </tr>
            )}

            {!agentsLoading &&
              agents.map((a) => (
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a._id)}
                      onChange={() => toggleSelect(a._id)}
                    />
                  </td>
                  <td className="p-2">
                    {a.image?.url ? (
                      <img
                        src={a.image.url || a.photoUrl}
                        alt={a.name || "agent"}
                        className="w-10 h-10 rounded object-cover border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border bg-gray-50" />
                    )}
                  </td>
                  <td className="p-2 text-xs">{a.order ?? 0}</td>
                  <td className="p-2 font-medium">{a.name || "—"}</td>
                  <td className="p-2 text-xs">{a.area || "—"}</td>
                  <td className="p-2 text-xs font-mono">
                    {a.mobile ? (
                      <a href={`tel:${a.mobile}`} className="text-blue-600">
                        {a.mobile}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-xs">{a.nid || "—"}</td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                      //clickin will take it to edit page
                      onClick={() => router.push(`/agents/${a._id}/edit`)}
                    >
                      Edit
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                        onClick={() => deleteOne(a._id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/agent-groups/${groupId}`}
          className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
        >
          ← Back to details
        </Link>
        <Link
          href="/agent-groups"
          className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
        >
          All agent groups
        </Link>
      </div>
    </div>
  );
}
