// app/(dash)/geo/ui/BulkGeoUploadClient.jsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function BulkGeoUploadClient() {
  const [file, setFile] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setRes(null);
    if (!file) return setErr("Choose an Excel file");
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/geo/bulk?dry=${dryRun ? "1" : "0"}`, {
        method: "POST",
        body: fd,
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || "Failed");
      setRes(j);
    } catch (e) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={() => history.back()}
        >
          ← Back
        </button>
        <Link className="text-blue-600 underline" href="/geo">
          Location Manager
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Bulk Upload Locations</h1>

      <div className="rounded border bg-white p-4 space-y-2 text-sm">
        <p>
          Columns (case-insensitive): <b>Type</b>, <b>Name</b>,{" "}
          <b>ParentType</b>, <b>ParentName</b>, <b>Code</b>, <b>Sort</b>,{" "}
          <b>Active</b>.
        </p>
        <a
          href="/api/geo/bulk?template=1"
          className="inline-block bg-gray-800 text-white px-3 py-1.5 rounded"
        >
          Download Template
        </a>
      </div>

      <form onSubmit={submit} className="rounded border bg-white p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Excel file
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Validate only (dry run)
        </label>
        <div className="flex items-center gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? "Processing…" : dryRun ? "Validate" : "Upload & Import"}
          </button>
          <button
            type="button"
            className="px-4 py-2 border rounded"
            onClick={() => {
              setFile(null);
              setRes(null);
              setErr("");
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {res && (
        <div className="rounded border bg-white p-4 text-sm space-y-3">
          <div className="font-medium">
            {res.dryRun ? "Validation Result" : "Import Result"}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Total rows" value={res.totalRows} />
            <Stat label="Valid" value={res.valid} />
            <Stat label="Invalid" value={res.invalid} />
            {!res.dryRun && <Stat label="Inserted" value={res.inserted} />}
          </div>
          {Array.isArray(res.errors) && res.errors.length > 0 && (
            <div>
              <div className="font-medium mt-2 mb-1">Errors</div>
              <ul className="list-disc pl-5 space-y-1">
                {res.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.error}
                  </li>
                ))}
              </ul>
              {res.errors.length > 50 && (
                <div className="text-xs text-gray-500 mt-1">
                  Showing first 50 of {res.errors.length} errors.
                </div>
              )}
            </div>
          )}
          {res.dryRun && Array.isArray(res.sample) && res.sample.length > 0 && (
            <div>
              <div className="font-medium mb-1">Sample (first 5)</div>
              <div className="overflow-x-auto">
                <table className="min-w-[600px] text-xs border">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Type</Th>
                      <Th>Name</Th>
                      <Th>ParentId</Th>
                      <Th>Code</Th>
                      <Th>Sort</Th>
                      <Th>Active</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.sample.map((r, i) => (
                      <tr key={i} className="border-t">
                        <Td>{r.type}</Td>
                        <Td>{r.name}</Td>
                        <Td>{r.parentId || "—"}</Td>
                        <Td>{r.code || "—"}</Td>
                        <Td>{String(r.sort)}</Td>
                        <Td>{r.active ? "Yes" : "No"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={async () => {
                    if (!file) return;
                    setLoading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const resp = await fetch(`/api/geo/bulk?dry=0`, {
                        method: "POST",
                        body: fd,
                      });
                      const j = await resp.json().catch(() => ({}));
                      if (!resp.ok)
                        throw new Error(j?.error || "Import failed");
                      setRes(j);
                    } catch (e) {
                      setErr(e.message || "Import failed");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Import now
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 border rounded bg-gray-50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
function Th({ children }) {
  return <th className="text-left p-2">{children}</th>;
}
function Td({ children }) {
  return <td className="p-2">{children}</td>;
}
