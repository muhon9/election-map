// app/(dash)/persons/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

const PERSON_CATEGORIES = ["COMMITTEE", "RENOWNED", "COMMUNICATE", "CONTACT"];

function qs(obj) {
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, String(v));
    }
  });
  return sp.toString();
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function PersonsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  // you can later replace these with real perms, e.g. view_person, add_person
  const canView = true; // has(user, "view_person");
  const canAdd = false; // has(user, "add_person");

  const [q, setQ] = useState("");
  const [category, setCategory] = useState(""); // all
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const queryString = useMemo(() => {
    return qs({
      page,
      limit,
      q,
      category: category || undefined,
    });
  }, [page, limit, q, category]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const j = await fetchJSON(`/api/people?${queryString}`);
        setRows(j.items || []);
        setTotal(j.total || 0);
      } catch (e) {
        setErr(() => {
          try {
            const obj = JSON.parse(e.message);
            return obj?.error || "Failed to load persons";
          } catch {
            return "Failed to load persons";
          }
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [queryString]);

  // reset page when filters change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function clearFilters() {
    setQ("");
    setCategory("");
  }

  if (!canView) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        You don’t have permission to view persons.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Persons</h1>
        <div className="flex items-center gap-2">
          {canAdd && (
            <Link
              href="/persons/new"
              className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
            >
              New Person
            </Link>
          )}
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search (name / designation / notes)
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Md Rahim, President"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— All —</option>
              {PERSON_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2">
            <label className="text-xs text-gray-600">Per page</label>
            <select
              className="border rounded px-2 py-1"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Committee</th>
              <th className="text-left p-2">Area</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Designation</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-3 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-gray-500">
                  No persons found.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const committeeName =
                  r.committeeId && typeof r.committeeId === "object"
                    ? r.committeeId.name
                    : "";

                const committeeLink =
                  r.committeeId && typeof r.committeeId === "object"
                    ? `/committees/${r.committeeId._id}`
                    : null;

                const areaName =
                  r.area && typeof r.area === "object" ? r.area.name : "";

                const committeePosition = r.position;

                return (
                  <tr key={r._id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">
                      {/* If you later add a person detail page, link here */}
                      {r.name}
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-xs">
                        {r.category}
                      </span>
                    </td>
                    <td className="p-2">
                      {committeeLink && committeeName ? (
                        <Link
                          href={committeeLink}
                          className="text-blue-600 hover:underline"
                        >
                          {committeeName} - {committeePosition}
                        </Link>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {areaName ? (
                        <span>{areaName}</span>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {r.phone ? (
                        <span className="font-mono text-xs">{r.phone}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {r.designation || (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/persons/${r._id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {(rows.length && (page - 1) * limit + 1) || 0}–
          {(page - 1) * limit + rows.length} of {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-sm">
            Page {page} / {totalPages}
          </span>
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
