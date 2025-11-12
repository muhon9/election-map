// app/(dash)/mosqs/bulk/ui/BulkMosqClient.jsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export default function BulkMosqClient() {
  const fileRef = useRef(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function downloadTemplate() {
    const res = await fetch("/api/mosqs/bulk?template=1");
    if (!res.ok) {
      alert("Failed to download template");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mosq-upload-template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    setErr("");
    setResult(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Please choose an .xlsx file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`/api/mosqs/bulk${dryRun ? "?dry=1" : ""}`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error || "Upload failed");
        return;
      }
      setResult(j);
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/mosqs"
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">Bulk Upload Mosqs</h1>
        </div>
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={downloadTemplate}
        >
          Download Template
        </button>
      </div>

      <div className="rounded border bg-white p-4 space-y-3">
        <p className="text-sm text-gray-600">
          The template supports <b>either</b> <code>City → Ward</code> <b>or</b>{" "}
          <code>upazila → Union → Ward</code> per row. Provide only one path per
          row.
          <br />
          Columns: City, upazila, Union, Ward, Mosqname, Address, Contact, Lat,
          Lng.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Excel File (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx"
              ref={fileRef}
              className="block w-full"
            />
          </div>

          <label className="flex items-center gap-2 mt-6 md:mt-0">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (validate only)
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Uploading…" : dryRun ? "Validate" : "Upload"}
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
              <b>{result.dryRun ? "Dry run" : "Inserted"}</b> • Rows:{" "}
              {result.totalRows ?? 0} • Valid: {result.valid ?? 0} • Invalid:{" "}
              {result.invalid ?? 0}
              {!result.dryRun && (
                <>
                  {" "}
                  • Inserted: {result.inserted ?? 0}
                  {Array.isArray(result.insertErrors) &&
                    result.insertErrors.length > 0 && (
                      <> • Insert errors: {result.insertErrors.length}</>
                    )}
                </>
              )}
            </div>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div>
                <div className="font-medium mb-2">Row Errors</div>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Row</Th>
                        <Th>Error</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t">
                          <Td>{e.row}</Td>
                          <Td>{e.error}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {Array.isArray(result.sample) && result.sample.length > 0 && (
              <div>
                <div className="font-medium mb-2">
                  Sample (first 5 parsed docs)
                </div>
                <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto">
                  {JSON.stringify(result.sample, null, 2)}
                </pre>
              </div>
            )}

            {!result.dryRun &&
              Array.isArray(result.insertErrors) &&
              result.insertErrors.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Insert Errors</div>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <Th>#</Th>
                          <Th>Code</Th>
                          <Th>Message</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.insertErrors.map((e, i) => (
                          <tr key={i} className="border-t">
                            <Td>{e.index ?? i}</Td>
                            <Td>{e.code ?? ""}</Td>
                            <Td>{e.errmsg ?? ""}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left p-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`p-2 ${className}`}>{children}</td>;
}
