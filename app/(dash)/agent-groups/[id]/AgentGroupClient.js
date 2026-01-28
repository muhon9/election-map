"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function fetchJSON(url, opts) {
  const r = await fetch(url, { cache: "no-store", ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export default function AgentGroupClient({ group, agents }) {
  const router = useRouter();

  /* ---------------- Add single agent ---------------- */
  const [form, setForm] = useState({
    name: "",
    areaName: "",
    mobile: "",
    nid: "",
    order: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function addAgent(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    try {
      await fetchJSON("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          order: Number(form.order || 0),
          agentGroupId: group._id,
        }),
      });

      router.refresh();
      setForm({
        name: "",
        areaName: "",
        mobile: "",
        nid: "",
        order: "",
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Bulk upload ---------------- */
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  async function onImportChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `/api/agent-groups/${group._id}/import-agents?dry=1`,
        { method: "POST", body: fd },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setImportResult(j);
      setPendingFile(file);
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function confirmImport() {
    if (!pendingFile) return;

    setImporting(true);
    const fd = new FormData();
    fd.append("file", pendingFile);

    try {
      await fetchJSON(`/api/agent-groups/${group._id}/import-agents`, {
        method: "POST",
        body: fd,
      });
      setPendingFile(null);
      router.refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setImporting(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <div className="text-sm text-gray-600">
          Center: {group.center?.name || "—"}
        </div>
      </div>

      {/* Add agent */}
      <form
        onSubmit={addAgent}
        className="border rounded bg-white p-4 space-y-3"
      >
        <h3 className="font-medium">Add Agent</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Agent name"
            value={form.name}
            onChange={(e) => u("name", e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Area name"
            value={form.areaName}
            onChange={(e) => u("areaName", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Mobile"
            value={form.mobile}
            onChange={(e) => u("mobile", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="NID"
            value={form.nid}
            onChange={(e) => u("nid", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Order"
            value={form.order}
            onChange={(e) => u("order", e.target.value)}
          />
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add Agent"}
        </button>
      </form>

      {/* Bulk upload */}
      <div className="border rounded bg-white p-4 space-y-2">
        <h3 className="font-medium">Bulk Upload Agents</h3>
        <p className="text-xs text-gray-600">
          Columns: <code>name</code>, <code>areaName</code>, <code>mobile</code>
          , <code>nid</code>, <code>order</code>
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onImportChange}
          disabled={importing}
        />

        {importResult?.dryRun && (
          <div className="text-xs bg-emerald-50 border border-emerald-200 p-2 rounded">
            Valid: {importResult.valid} | Invalid: {importResult.invalid}
            <div className="mt-2">
              <button
                className="px-3 py-1.5 border rounded bg-white"
                onClick={confirmImport}
                disabled={importing}
              >
                Confirm import
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Agent list */}
      <div className="border rounded bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Order</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Area</th>
              <th className="p-2 text-left">Mobile</th>
              <th className="p-2 text-left">NID</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a._id} className="border-t">
                <td className="p-2">{a.order ?? "—"}</td>
                <td className="p-2 font-medium">{a.name}</td>
                <td className="p-2">{a.areaName || "—"}</td>
                <td className="p-2">{a.mobile || "—"}</td>
                <td className="p-2">{a.nid || "—"}</td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-gray-500">
                  No agents added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
