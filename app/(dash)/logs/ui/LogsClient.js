// app/(dash)/logs/ui/LogsClient.jsx
"use client";

import { useEffect, useState } from "react";

export default function LogsClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [q, setQ] = useState("");
  const [action, setAction] = useState(""); // e.g. "create,update"
  const [entityType, setEntityType] = useState("");

  async function load(p = 1) {
    try {
      setLoading(true);
      setErr("");
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (action) sp.set("action", action);
      if (entityType) sp.set("entityType", entityType);
      sp.set("page", String(p));
      sp.set("limit", "20");

      const res = await fetch(`/api/audit-logs?${sp.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load logs");
      setRows(j.items || []);
      setPage(j.page || 1);
      setPages(j.pages || 1);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1); /* eslint-disable-next-line */
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Audit Logs</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Search</label>
          <input
            className="border rounded px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="actor or summary"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Action</label>
          <select
            className="border rounded px-3 py-2"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="role_change">Role change</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Entity</label>
          <select
            className="border rounded px-3 py-2"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All</option>
            <option value="user">User</option>
            <option value="role">Role</option>
            <option value="center">Center</option>
            <option value="area">Area</option>
            <option value="person">Person</option>
          </select>
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => load(1)}
        >
          Apply
        </button>
      </div>

      {loading && (
        <div className="border rounded p-4 text-sm text-gray-600 bg-white">
          Loading…
        </div>
      )}
      {!loading && err && (
        <div className="border rounded p-4 text-sm text-red-600 bg-white">
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className="border rounded overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Time</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Summary</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No logs.
                  </td>
                </tr>
              ) : (
                rows.map((r) => <Row key={r._id} r={r} />)
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 border rounded disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => load(page - 1)}
        >
          Prev
        </button>
        <div className="text-sm text-gray-600">
          Page {page} / {pages}
        </div>
        <button
          className="px-3 py-1.5 border rounded disabled:opacity-50"
          disabled={page >= pages}
          onClick={() => load(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Row({ r }) {
  const [open, setOpen] = useState(false);
  const when = new Date(r.ts).toLocaleString();
  const entity = `${r.entityType}:${r.entityId}`;

  return (
    <>
      <tr className="border-t">
        <Td>{when}</Td>
        <Td>
          <div className="flex items-center gap-2">
            <span className="font-medium">{r.actorUsername || "—"}</span>
            {r.actorRoleName && (
              <span className="text-xs text-gray-500">({r.actorRoleName})</span>
            )}
          </div>
        </Td>
        <Td>
          <Badge action={r.action} />
        </Td>
        <Td>
          <code className="text-xs">{entity}</code>
        </Td>
        <Td>{r.summary || "—"}</Td>
        <Td>
          <button
            className="text-blue-600 underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "View"}
          </button>
        </Td>
      </tr>
      {open && (
        <tr className="border-t bg-gray-50/60">
          <td colSpan={6} className="p-3">
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold mb-1">Before</div>
                <pre className="bg-white rounded border p-2 overflow-auto">
                  {JSON.stringify(r.diff?.before || {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-semibold mb-1">After</div>
                <pre className="bg-white rounded border p-2 overflow-auto">
                  {JSON.stringify(r.diff?.after || {}, null, 2)}
                </pre>
              </div>
            </div>
            {(r.ip || r.userAgent) && (
              <div className="mt-2 text-xs text-gray-500">
                {r.ip ? <span>IP: {r.ip} </span> : null}
                {r.userAgent ? <span>UA: {r.userAgent}</span> : null}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Badge({ action }) {
  const map = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    role_change: "bg-violet-100 text-violet-700",
    default: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${map[action] || map.default}`}
    >
      {action}
    </span>
  );
}

function Th({ children }) {
  return <th className="text-left p-2">{children}</th>;
}
function Td({ children }) {
  return <td className="p-2 align-top">{children}</td>;
}
