"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

const TABS = [
  { key: "COMMITTEE", label: "Committee" },
  { key: "RENOWNED", label: "Important" }, // send RENOWNED to API
  { key: "CONTACT", label: "Contacts" },
];

export default function PeopleEditor({ areaId, defaultCategory }) {
  const { data: session } = useSession();
  const user = session?.user;
  const canView = has(user, "view_centers");
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  // tab now can be controlled by parent via defaultCategory
  const initialTab = TABS.some((t) => t.key === defaultCategory)
    ? defaultCategory
    : "COMMITTEE";
  const [tab, setTab] = useState(initialTab);

  // keep tab in sync if parent changes defaultCategory
  useEffect(() => {
    if (
      TABS.some((t) => t.key === defaultCategory) &&
      defaultCategory !== tab
    ) {
      setTab(defaultCategory);
    }
  }, [defaultCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // list state
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // sort defaults per tab
  const [sort, setSort] = useState("order"); // committee default
  const [dir, setDir] = useState("asc");

  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(false);

  // create form state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    designation: "",
    notes: "",
    importance: "", // for RENOWNED
    committeeName: "",
    position: "",
    order: "", // for COMMITTEE
  });

  // inline editing
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  // Lock sort/dir per tab
  useEffect(() => {
    if (tab === "COMMITTEE") {
      setSort("order");
      setDir("asc");
    } else if (tab === "RENOWNED") {
      setSort("importance");
      setDir("desc");
    } else {
      // CONTACT
      setSort("name");
      setDir("asc");
    }
    setPage(1);
  }, [tab]);

  const fetchList = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const url =
        `/api/areas/${areaId}/people?category=${tab}` +
        `&q=${encodeURIComponent(q)}` +
        `&page=${page}&limit=${limit}&sort=${sort}&dir=${dir}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      setData(j || { items: [], total: 0, pages: 1, page: 1 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [areaId, tab, q, page, limit, sort, dir, canView]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // reset create + edit draft when tab changes
  useEffect(() => {
    setForm({
      name: "",
      phone: "",
      designation: "",
      notes: "",
      importance: "",
      committeeName: "",
      position: "",
      order: "",
    });
    setEditingId(null);
    setEditDraft({});
  }, [tab]);

  // CREATE
  async function onCreate(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      category: tab, // COMMITTEE | RENOWNED | CONTACT
      name: (form.name || "").trim(),
      phone: (form.phone || "").trim(),
      designation: (form.designation || "").trim(),
      notes: (form.notes || "").trim(),
    };

    if (tab === "COMMITTEE") {
      payload.committeeName = (form.committeeName || "").trim();
      payload.position = (form.position || "").trim();
      payload.order = Number(form.order || 0);
    } else if (tab === "RENOWNED") {
      payload.importance = Number(form.importance || 0);
    }

    if (!payload.name) return alert("Name is required");
    if (tab === "CONTACT" && !payload.phone)
      return alert("Phone is required for Contacts");

    const res = await fetch(`/api/areas/${areaId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to add person");
      return;
    }

    setForm({
      name: "",
      phone: "",
      designation: "",
      notes: "",
      importance: "",
      committeeName: "",
      position: "",
      order: "",
    });
    fetchList();
  }

  // Inline edit: start/cancel/save
  function startEdit(row) {
    if (!canEdit) return;
    setEditingId(row._id);
    setEditDraft({
      name: row.name || "",
      phone: row.phone || "",
      designation: row.designation || "",
      notes: row.notes || "",
      importance: row.importance ?? "",
      committeeName: row.committeeName || "",
      position: row.position || "",
      order: row.order ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
  }

  async function saveEdit(id) {
    const payload = {
      name: (editDraft.name || "").trim(),
      phone: (editDraft.phone || "").trim(),
      designation: (editDraft.designation || "").trim(),
      notes: (editDraft.notes || "").trim(),
    };
    if (tab === "COMMITTEE") {
      payload.committeeName = (editDraft.committeeName || "").trim();
      payload.position = (editDraft.position || "").trim();
      payload.order = Number(editDraft.order || 0);
    } else if (tab === "RENOWNED") {
      payload.importance = Number(editDraft.importance || 0);
    }
    if (!payload.name) return alert("Name is required");
    if (tab === "CONTACT" && !payload.phone)
      return alert("Phone is required for Contacts");

    const res = await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to update person");
      return;
    }
    setEditingId(null);
    setEditDraft({});
    fetchList();
  }

  // Delete
  async function onDelete(id) {
    if (!canDelete) return;
    if (!confirm("Delete this person?")) return;
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete person");
      return;
    }
    fetchList();
  }

  // Committee reorder (swap order)
  async function moveRow(id, direction) {
    if (tab !== "COMMITTEE" || !canEdit) return;
    const items = [...(data.items || [])].sort((a, b) => {
      const ao = a.order ?? 0,
        bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return (a.name || "").localeCompare(b.name || "");
    });
    const idx = items.findIndex((x) => x._id === id);
    if (idx === -1) return;

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= items.length) return;

    const a = items[idx];
    const b = items[swapWith];

    const aNewOrder = b.order ?? 0;
    const bNewOrder = a.order ?? 0;

    const r1 = await fetch(`/api/people/${a._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: aNewOrder }),
    });
    if (!r1.ok) return alert("Failed to move item");

    const r2 = await fetch(`/api/people/${b._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: bNewOrder }),
    });
    if (!r2.ok) return alert("Failed to move item");

    fetchList();
  }

  // Sorting (disabled for Committee)
  function toggleSort(field) {
    if (tab === "COMMITTEE") return;
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir(field === "importance" ? "desc" : "asc");
    }
  }

  if (!canView) {
    return (
      <div className="p-3 text-sm text-gray-600">
        You don’t have permission to view people.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded border text-sm ${
              tab === t.key
                ? "bg-blue-600 text-white border-blue-600"
                : "hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {canEdit && (
        <form
          onSubmit={onCreate}
          className="p-4 border rounded bg-white grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Phone{" "}
              {tab === "CONTACT" && <span className="text-red-500">*</span>}
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Designation
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={form.designation}
              onChange={(e) =>
                setForm((f) => ({ ...f, designation: e.target.value }))
              }
            />
          </div>

          {tab === "COMMITTEE" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Committee name
                </label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.committeeName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, committeeName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.position}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, position: e.target.value }))
                  }
                />
              </div>
              {/* <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Order
                </label>
                <input
                  type="number"
                  min="0"
                  className="border rounded w-full px-3 py-2"
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, order: e.target.value }))
                  }
                />
              </div> */}
            </>
          )}

          {/* {tab === "RENOWNED" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Importance
              </label>
              <input
                type="number"
                min="0"
                className="border rounded w-full px-3 py-2"
                value={form.importance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, importance: e.target.value }))
                }
              />
            </div>
          )} */}

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              className="border rounded w-full px-3 py-2"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <div className="md:col-span-3">
            <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
              Add{" "}
              {tab === "COMMITTEE"
                ? "member"
                : tab === "RENOWNED"
                ? "person"
                : "contact"}
            </button>
          </div>
        </form>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {TABS.find((t) => t.key === tab)?.label} – {data.total} total
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder={`Search ${TABS.find(
              (t) => t.key === tab
            )?.label.toLowerCase()}…`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="border rounded px-2 py-2 text-sm"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border overflow-x-auto bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <Th
                field="name"
                sort={sort}
                dir={dir}
                onSort={toggleSort}
                disabled={tab === "COMMITTEE"}
              >
                Name
              </Th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Designation</th>
              {tab === "COMMITTEE" && (
                <th className="text-left p-2">Committee / Position</th>
              )}
              {tab === "COMMITTEE" && (
                <Th
                  field="order"
                  sort={sort}
                  dir={dir}
                  onSort={() => {}}
                  disabled
                >
                  Order
                </Th>
              )}
              {tab === "RENOWNED" && (
                <Th
                  field="importance"
                  sort={sort}
                  dir={dir}
                  onSort={toggleSort}
                >
                  Importance
                </Th>
              )}
              <th className="text-left p-2 w-[220px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  className="p-3 text-gray-500"
                  colSpan={tab === "COMMITTEE" ? 6 : 5}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr>
                <td
                  className="p-3 text-gray-500"
                  colSpan={tab === "COMMITTEE" ? 6 : 5}
                >
                  No items.
                </td>
              </tr>
            )}
            {!loading &&
              data.items.map((p, idx) => {
                const isEditingRow = editingId === p._id;
                return (
                  <tr key={p._id} className="border-t align-top">
                    {/* Name */}
                    <td className="p-2 font-medium">
                      {isEditingRow ? (
                        <input
                          className="border rounded w-full px-2 py-1"
                          value={editDraft.name}
                          onChange={(e) =>
                            setEditDraft((s) => ({
                              ...s,
                              name: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        p.name
                      )}
                    </td>

                    {/* Phone */}
                    <td className="p-2">
                      {isEditingRow ? (
                        <input
                          className="border rounded w-full px-2 py-1"
                          value={editDraft.phone}
                          onChange={(e) =>
                            setEditDraft((s) => ({
                              ...s,
                              phone: e.target.value,
                            }))
                          }
                        />
                      ) : p.phone ? (
                        <a
                          className="text-blue-600 underline"
                          href={`tel:${p.phone}`}
                        >
                          {p.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Designation */}
                    <td className="p-2">
                      {isEditingRow ? (
                        <input
                          className="border rounded w-full px-2 py-1"
                          value={editDraft.designation}
                          onChange={(e) =>
                            setEditDraft((s) => ({
                              ...s,
                              designation: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        p.designation || "—"
                      )}
                    </td>

                    {/* Committee fields */}
                    {tab === "COMMITTEE" && (
                      <>
                        <td className="p-2">
                          {isEditingRow ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                className="border rounded w-full px-2 py-1"
                                placeholder="Committee"
                                value={editDraft.committeeName}
                                onChange={(e) =>
                                  setEditDraft((s) => ({
                                    ...s,
                                    committeeName: e.target.value,
                                  }))
                                }
                              />
                              <input
                                className="border rounded w-full px-2 py-1"
                                placeholder="Position"
                                value={editDraft.position}
                                onChange={(e) =>
                                  setEditDraft((s) => ({
                                    ...s,
                                    position: e.target.value,
                                  }))
                                }
                              />
                              <input
                                type="number"
                                min="0"
                                className="border rounded w-full px-2 py-1"
                                placeholder="Order"
                                value={editDraft.order}
                                onChange={(e) =>
                                  setEditDraft((s) => ({
                                    ...s,
                                    order: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          ) : (
                            <div>
                              {p.committeeName || "—"}
                              {p.position ? ` • ${p.position}` : ""}
                              {typeof p.order === "number"
                                ? ` • #${p.order}`
                                : ""}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {/* Order header shown above; cell rendered inside committee fields */}
                        </td>
                      </>
                    )}

                    {/* Importance for RENOWNED */}
                    {tab === "RENOWNED" && (
                      <td className="p-2">
                        {isEditingRow ? (
                          <input
                            type="number"
                            min="0"
                            className="border rounded w-full px-2 py-1"
                            value={editDraft.importance}
                            onChange={(e) =>
                              setEditDraft((s) => ({
                                ...s,
                                importance: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          p.importance ?? 0
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {tab === "COMMITTEE" && canEdit && (
                          <>
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                              onClick={() => moveRow(p._id, "up")}
                              disabled={idx === 0}
                            >
                              ↑ Up
                            </button>
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                              onClick={() => moveRow(p._id, "down")}
                              disabled={idx === data.items.length - 1}
                            >
                              ↓ Down
                            </button>
                          </>
                        )}

                        {canEdit && !isEditingRow && (
                          <button
                            className="px-2 py-1 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-50"
                            onClick={() => startEdit(p)}
                          >
                            Edit
                          </button>
                        )}
                        {canEdit && isEditingRow && (
                          <>
                            <button
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              onClick={() => saveEdit(p._id)}
                            >
                              Save
                            </button>
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            className="px-2 py-1 text-red-700 border border-red-200 rounded text-xs hover:bg-red-50"
                            onClick={() => onDelete(p._id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
          Page <b>{data.page || 1}</b> of <b>{data.pages || 1}</b>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={(data.page || 1) <= 1}
          >
            Prev
          </button>
          {Array.from({ length: data.pages || 1 }, (_, i) => i + 1)
            .slice(Math.max(0, page - 3), page + 2)
            .map((n) => (
              <button
                key={n}
                className={`px-3 py-1.5 border rounded text-sm ${
                  n === page ? "bg-blue-600 text-white border-blue-600" : ""
                }`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          <button
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(data.pages || 1, p + 1))}
            disabled={(data.page || 1) >= (data.pages || 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, field, sort, dir, onSort, disabled }) {
  const active = sort === field;
  return (
    <th className="text-left p-2 select-none">
      <span
        role="button"
        className={`inline-flex items-center gap-1 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={() => !disabled && onSort(field)}
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}
