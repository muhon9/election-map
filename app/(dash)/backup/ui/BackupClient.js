// app/(dash)/backup/ui/BackupClient.jsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function BackupClient() {
  const fileRef = useRef(null);

  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState([]); // optional subset to dump/restore

  const [gzip, setGzip] = useState(true);
  const [mode, setMode] = useState("merge"); // merge|wipe
  const [dryRun, setDryRun] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  // Load collection names (reuse GET without downloading body by HEAD ping)
  useEffect(() => {
    // We don't have a dedicated endpoint to list collections, so piggyback:
    (async () => {
      try {
        setErr("");
        // Request a tiny JSON (no gzip, and only meta) by limiting to none → we’ll fallback to all on UI
        // Simpler: just do a small dump and read meta + names
        const res = await fetch("/api/backup?gzip=0", { cache: "no-store" });
        const text = await res.text();
        const j = JSON.parse(text);
        const names = Object.keys(j?.collections || {});
        // If collections came empty (unlikely), leave selection empty = all
        setCollections(names);
        setSelected(names);
      } catch (_e) {
        // Ignore listing failure; buttons still work for "all"
      }
    })();
  }, []);

  function buildQuery() {
    const sp = new URLSearchParams();
    if (gzip) sp.set("gzip", "1");
    if (selected.length) sp.set("collections", selected.join(","));
    return sp.toString();
  }

  async function download() {
    const qs = buildQuery();
    const res = await fetch(`/api/backup?${qs}`, { method: "GET" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Backup download failed");
      return;
    }
    const blob = await res.blob();
    const cdisp =
      res.headers.get("content-disposition") ||
      "attachment; filename=backup.json";
    const name = (cdisp.split("filename=")[1] || "backup.json").replace(
      /(^"|"$)/g,
      ""
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function restore() {
    setErr("");
    setResult(null);

    const f = fileRef.current?.files?.[0];
    if (!f) {
      setErr("Choose a backup file (.json or .json.gz)");
      return;
    }

    const sp = new URLSearchParams();
    if (mode === "wipe") sp.set("mode", "wipe");
    if (dryRun) sp.set("dry", "1");
    if (selected.length) sp.set("collections", selected.join(","));

    const fd = new FormData();
    fd.append("file", f);

    setLoading(true);
    try {
      const res = await fetch(`/api/backup?${sp.toString()}`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error || "Restore failed");
        return;
      }
      setResult(j);
    } catch (e) {
      setErr(e?.message || "Restore failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(name) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold">Backup & Restore</h1>

      <section className="rounded border bg-white p-4 space-y-3">
        <h2 className="font-medium">Download backup</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={gzip}
              onChange={(e) => setGzip(e.target.checked)}
            />
            Gzip (.json.gz)
          </label>
          <div className="md:col-span-2 text-sm text-gray-600">
            You can optionally pick specific collections; otherwise everything
            will be included.
          </div>
        </div>

        {collections.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-gray-600 mb-1">
              Collections
            </div>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <label
                  key={c}
                  className="px-2 py-1 border rounded text-sm flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c)}
                    onChange={() => toggle(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={download}
          >
            Download backup
          </button>
        </div>
      </section>

      <section className="rounded border bg-white p-4 space-y-3">
        <h2 className="font-medium">Restore from backup</h2>

        <div className="grid md:grid-cols-3 gap-3 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Backup file
            </label>
            <input type="file" ref={fileRef} accept=".json,.gz,.json.gz" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mode
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="merge">Merge (upsert by _id)</option>
              <option value="wipe">Wipe & insert (dangerous)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 mt-6 md:mt-6">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (validate only)
          </label>
        </div>

        {collections.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">
              Collections to restore
            </div>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <label
                  key={c}
                  className="px-2 py-1 border rounded text-sm flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c)}
                    onChange={() => toggle(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              If none selected, all collections in the file will be restored.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={restore}
            disabled={loading}
          >
            {loading ? "Processing…" : dryRun ? "Validate restore" : "Restore"}
          </button>
          <button
            className="px-4 py-2 rounded border"
            onClick={() => {
              setErr("");
              setResult(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Reset
          </button>
        </div>

        {err && (
          <div className="rounded border bg-red-50 text-red-700 p-3">{err}</div>
        )}

        {result && (
          <div className="rounded border bg-white p-3 space-y-3">
            <div className="text-sm">
              <b>{result.dryRun ? "Dry run" : "Restore"}</b> • Mode:{" "}
              {result.mode} • DB: {result.fileMeta?.dbName || "?"}
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Collection</Th>
                    <Th>Count in file</Th>
                    <Th>Inserted</Th>
                    <Th>Upserted</Th>
                    <Th>Mode</Th>
                    <Th>Dry</Th>
                    <Th>Error</Th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(result.restored) &&
                  result.restored.length > 0 ? (
                    result.restored.map((r, i) => (
                      <tr key={i} className="border-t">
                        <Td>{r.collection}</Td>
                        <Td>{r.count ?? 0}</Td>
                        <Td>{r.inserted ?? 0}</Td>
                        <Td>{r.upserted ?? 0}</Td>
                        <Td>{r.mode}</Td>
                        <Td>{r.dryRun ? "Yes" : "No"}</Td>
                        <Td>{r.error ? String(r.error) : "—"}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={7}>No results.</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {result.fileMeta && (
              <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto">
                {JSON.stringify(result.fileMeta, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left p-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }) {
  return (
    <td className={`p-2 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
