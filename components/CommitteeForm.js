"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UploaderMini from "@/components/UploaderMini";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function CommitteeForm({ committee = null, onSaved }) {
  const router = useRouter();

  // ---------- Base fields ----------
  const [form, setForm] = useState({
    name: committee?.name || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // ---------- Files (attachments) ----------
  const [files, setFiles] = useState(committee?.files || []);
  const addFiles = (newOnes) => setFiles((prev) => [...prev, ...newOnes]);
  const removeFileAt = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  // ---------- Geography (city / rural) ----------

  const initialMode = committee?.cityId
    ? "city"
    : committee?.upazilaId
    ? "rural"
    : "city";

  const [mode, setMode] = useState(initialMode);

  const [cityId, setCityId] = useState(committee?.cityId?._id || "");
  const [cityWardId, setCityWardId] = useState(
    committee?.cityId ? committee?.wardId?._id || "" : ""
  );

  const [upazilaId, setUpazilaId] = useState(committee?.upazilaId?._id || "");
  const [unionId, setUnionId] = useState(committee?.unionId?._id || "");
  const [ruralWardId, setRuralWardId] = useState(
    committee?.upazilaId ? committee?.wardId?._id || "" : ""
  );

  const [cityCorps, setCityCorps] = useState([]);
  const [cityWards, setCityWards] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [ruralWards, setRuralWards] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [cc, upa] = await Promise.all([
          fetchJSON("/api/geo?type=city_corporation&active=1"),
          fetchJSON("/api/geo?type=upazila&active=1"),
        ]);
        setCityCorps(cc.items || []);
        setUpazilas(upa.items || []);
      } catch (e) {
        console.error("Failed loading geo top-level", e);
      }
    })();
  }, []);

  // Preload children on edit
  useEffect(() => {
    (async () => {
      try {
        if (committee?.cityId?._id) {
          const wards = await fetchJSON(
            `/api/geo?parentId=${committee.cityId._id}&active=1`
          );
          setCityWards(wards.items || []);
        }
        if (committee?.upazilaId?._id) {
          const us = await fetchJSON(
            `/api/geo?parentId=${committee.upazilaId._id}&active=1`
          );
          setUnions(us.items || []);
        }
        if (committee?.unionId?._id) {
          const ws = await fetchJSON(
            `/api/geo?parentId=${committee.unionId._id}&active=1`
          );
          setRuralWards(ws.items || []);
        }
      } catch (e) {
        console.error("Failed preload children", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?._id]);

  // City changed -> load city wards, clear rural path
  useEffect(() => {
    if (!cityId) {
      setCityWards([]);
      setCityWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
        setCityWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    setUpazilaId("");
    setUnionId("");
    setRuralWardId("");
    setMode("city");
  }, [cityId]);

  // Upazila changed -> load unions, clear city path
  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      setUnionId("");
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`);
        setUnions(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
    setCityId("");
    setCityWardId("");
    setMode("rural");
  }, [upazilaId]);

  // Union changed -> load rural wards
  useEffect(() => {
    if (!unionId) {
      setRuralWards([]);
      setRuralWardId("");
      return;
    }
    (async () => {
      try {
        const j = await fetchJSON(`/api/geo?parentId=${unionId}&active=1`);
        setRuralWards(j.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [unionId]);

  function chooseMode(next) {
    setMode(next);
    if (next === "city") {
      setUpazilaId("");
      setUnionId("");
      setRuralWardId("");
    } else {
      setCityId("");
      setCityWardId("");
    }
  }

  // ---------- Centers (multi-select, populated) ----------
  const [centerSearch, setCenterSearch] = useState("");
  const [centerOpts, setCenterOpts] = useState([]);

  const [centers, setCenters] = useState(
    Array.isArray(committee?.centers)
      ? committee.centers.map((c) => ({
          _id: c._id,
          name: c.name || "",
        }))
      : []
  );

  const centerTimer = useRef(null);

  function doCenterSearch(term) {
    const q = term ? `?q=${encodeURIComponent(term)}&limit=10` : `?limit=10`;
    fetchJSON(`/api/centers${q}`)
      .then((j) => setCenterOpts(j.items || []))
      .catch(() => setCenterOpts([]));
  }

  function onCenterInput(e) {
    const v = e.target.value;
    setCenterSearch(v);
    if (centerTimer.current) clearTimeout(centerTimer.current);
    centerTimer.current = setTimeout(() => doCenterSearch(v), 300);
  }

  function toggleCenter(c) {
    setCenters((prev) => {
      const exists = prev.some((x) => String(x._id) === String(c._id));
      if (exists) {
        return prev.filter((x) => String(x._id) !== String(c._id));
      }
      return [...prev, { _id: c._id, name: c.name || "" }];
    });
  }

  // ---------- Areas (multi-select, like centers) ----------

  const [areaSearch, setAreaSearch] = useState("");

  // Seed from committee.areas (preferred) or legacy areaId
  const [areas, setAreas] = useState(() => {
    if (Array.isArray(committee?.areas) && committee.areas.length > 0) {
      return committee.areas.map((a) => ({
        _id: a._id,
        name: a.name || "",
        code: a.code,
        centerName:
          a.centerName ||
          (a.center && typeof a.center === "object"
            ? a.center.name
            : undefined),
      }));
    }
    if (committee?.areaId && typeof committee.areaId === "object") {
      const a = committee.areaId;
      return [
        {
          _id: a._id,
          name: a.name || "",
          code: a.code,
          centerName:
            a.centerName ||
            (a.center && typeof a.center === "object"
              ? a.center.name
              : undefined),
        },
      ];
    }
    return [];
  });

  const [areaOpts, setAreaOpts] = useState([]); // suggestions only after search
  const areaTimer = useRef(null);

  function doAreaSearch(term) {
    const q = term ? `?q=${encodeURIComponent(term)}&limit=10` : `?limit=10`;
    fetchJSON(`/api/areas${q}`)
      .then((j) => {
        const items = j.items || [];
        setAreaOpts(items);
      })
      .catch(() => {
        setAreaOpts([]);
      });
  }

  function onAreaInput(e) {
    const v = e.target.value;
    setAreaSearch(v);
    if (areaTimer.current) clearTimeout(areaTimer.current);
    if (!v.trim()) {
      setAreaOpts([]);
      return;
    }
    areaTimer.current = setTimeout(() => doAreaSearch(v), 300);
  }

  function toggleArea(a) {
    setAreas((prev) => {
      const exists = prev.some((x) => String(x._id) === String(a._id));
      if (exists) {
        return prev.filter((x) => String(x._id) !== String(a._id));
      }
      return [
        ...prev,
        {
          _id: a._id,
          name: a.name || "",
          code: a.code,
          centerName:
            a.centerName ||
            (a.center && typeof a.center === "object"
              ? a.center.name
              : a.center),
        },
      ];
    });
  }

  // ---------- Bulk import committee persons (Excel) ----------
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErr, setImportErr] = useState("");
  const importInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null); // for confirm step

  async function onImportChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!committee?._id) {
      alert("Please save the committee first before importing members.");
      e.target.value = "";
      return;
    }

    setImportErr("");
    setImportResult(null);
    setPendingFile(null);
    setImporting(true);

    try {
      // First: DRY RUN
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        `/api/committees/${committee._id}/import-people?dry=1`,
        {
          method: "POST",
          body: fd,
        }
      );

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setImportErr(j?.error || "Failed to run dry-run import");
        setImportResult(null);
        setPendingFile(null);
      } else {
        // Store preview + keep file in memory for confirm step
        setImportResult(j);
        setPendingFile(file);
      }
    } catch (err) {
      console.error(err);
      setImportErr("Network error during import");
      setImportResult(null);
      setPendingFile(null);
    } finally {
      setImporting(false);
      if (e.target) e.target.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!pendingFile) {
      alert("No file ready to import. Please choose a file again.");
      return;
    }

    if (!committee?._id) {
      alert("Committee is not saved yet.");
      return;
    }

    setImportErr("");
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append("file", pendingFile);

      const res = await fetch(
        `/api/committees/${committee._id}/import-people`,
        {
          method: "POST",
          body: fd,
        }
      );

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setImportErr(j?.error || "Failed to import committee members");
      } else {
        setImportResult(j);
        setPendingFile(null);
        // optionally refresh to show new people counts etc.
        router.refresh();
        // Also refetch members list below
        await loadMembersForCommittee();
      }
    } catch (err) {
      console.error(err);
      setImportErr("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  // ---------- Committee Members (list + bulk delete) ----------

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [membersDeleting, setMembersDeleting] = useState(false);

  async function loadMembersForCommittee() {
    if (!committee?._id) return;
    setMembersLoading(true);
    setMembersErr("");
    try {
      // adjust this URL if your API is different
      const j = await fetchJSON(
        `/api/people?committeeId=${committee._id}&category=COMMITTEE&limit=500&sort=order&dir=asc`
      );
      const items = Array.isArray(j.items) ? j.items : j;
      setMembers(items || []);
      setSelectedMemberIds([]);
    } catch (e) {
      console.error(e);
      setMembersErr(e.message || "Failed to load committee members");
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  useEffect(() => {
    if (!committee?._id) return;
    loadMembersForCommittee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?._id]);

  function toggleMemberSelection(id) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllMembers() {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map((m) => m._id));
    }
  }

  async function handleDeleteSelectedMembers() {
    if (!selectedMemberIds.length) {
      alert("No members selected.");
      return;
    }
    if (
      !confirm(
        `Delete ${selectedMemberIds.length} selected member(s) from this committee? This cannot be undone.`
      )
    )
      return;

    setMembersDeleting(true);
    try {
      // delete one by one using existing API
      await Promise.all(
        selectedMemberIds.map((id) =>
          fetch(`/api/people/${id}`, { method: "DELETE" })
        )
      );
      // remove from UI
      setMembers((prev) =>
        prev.filter((m) => !selectedMemberIds.includes(m._id))
      );
      setSelectedMemberIds([]);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete some members. Please refresh and try again.");
    } finally {
      setMembersDeleting(false);
    }
  }

  // ---------- Submit ----------
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    const payload = {
      name: (form.name || "").trim(),
      files: files.map((f) => ({
        url: f.url,
        filename: f.filename || "",
        mime: f.mime || "",
        size: Number(f.size || 0),
        thumbnailUrl: f.thumbnailUrl || "",
      })),
      centers: centers.map((c) => c._id),
      areas: areas.map((a) => a._id), // ✅ multi areas
      // areaId: null, // optional: keep null if backend still has legacy field
    };

    if (!payload.name) {
      setSaving(false);
      setErr("Committee name is required");
      return;
    }

    if (mode === "city") {
      payload.cityId = cityId || null;
      payload.upazilaId = null;
      payload.unionId = null;
      payload.wardId = cityWardId || null;
    } else {
      payload.cityId = null;
      payload.upazilaId = upazilaId || null;
      payload.unionId = unionId || null;
      payload.wardId = ruralWardId || null;
    }

    try {
      const url = committee?._id
        ? `/api/committees/${committee._id}`
        : `/api/committees`;
      const method = committee?._id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      setSaving(false);

      if (!res.ok) {
        setErr(j?.error || "Failed to save committee");
        return;
      }

      onSaved?.(j);
      if (committee?._id) {
        router.refresh();
      } else {
        router.push(`/committees/${j._id}`);
      }
    } catch (e) {
      setSaving(false);
      setErr("Network error");
    }
  }

  // ---------- UI ----------
  return (
    <form onSubmit={onSubmit} className="rounded border bg-white p-4 space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Committee Name
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          value={form.name}
          onChange={(e) => u("name", e.target.value)}
          required
        />
      </div>

      {/* Administrative Location */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            Administrative Location
          </span>
          <div className="flex items-center gap-1 ml-3">
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "city" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("city")}
              title="City Corporation → City Ward"
            >
              City
            </button>
            <button
              type="button"
              className={`px-2 py-1 border rounded ${
                mode === "rural" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
              }`}
              onClick={() => chooseMode("rural")}
              title="Upazila → Union → Ward"
            >
              Upazila
            </button>
          </div>
        </div>

        {mode === "city" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Corporation
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">— Select City Corporation —</option>
                {cityCorps.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                City Ward
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={cityWardId}
                onChange={(e) => setCityWardId(e.target.value)}
                disabled={!cityId}
              >
                <option value="">— Select City Ward —</option>
                {cityWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upazila
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={upazilaId}
                onChange={(e) => setUpazilaId(e.target.value)}
              >
                <option value="">— Select Upazila —</option>
                {upazilas.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Union
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={unionId}
                onChange={(e) => setUnionId(e.target.value)}
                disabled={!upazilaId}
              >
                <option value="">— Select Union —</option>
                {unions.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ward (Union)
              </label>
              <select
                className="border rounded w-full px-3 py-2"
                value={ruralWardId}
                onChange={(e) => setRuralWardId(e.target.value)}
                disabled={!unionId}
              >
                <option value="">— Select Ward —</option>
                {ruralWards.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Centers (multi) */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">
          Attach Centers (search)
        </label>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Type to search centers…"
            value={centerSearch}
            onChange={onCenterInput}
          />
        </div>
        {centerOpts.length > 0 && (
          <div className="border rounded p-2 max-h-56 overflow-auto bg-white">
            {centerOpts.map((c) => {
              const active = centers.some(
                (x) => String(x._id) === String(c._id)
              );
              return (
                <button
                  key={c._id}
                  type="button"
                  className={`w-full text-left px-2 py-1 rounded hover:bg-gray-50 ${
                    active ? "bg-blue-50" : ""
                  }`}
                  onClick={() => toggleCenter(c)}
                >
                  <div className="font-medium">{c.name}</div>
                </button>
              );
            })}
          </div>
        )}
        {centers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {centers.map((c) => (
              <span
                key={c._id}
                className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-sm"
              >
                {c.name || c._id}
                <button
                  type="button"
                  className="ml-1 text-red-600"
                  onClick={() => toggleCenter({ _id: c._id })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Areas (multi, like centers) */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">
          Attach Areas (search)
        </label>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Type to search areas…"
            value={areaSearch}
            onChange={onAreaInput}
          />
        </div>
        {/* Suggestions only after user has typed something */}
        {areaSearch.trim() && areaOpts.length > 0 && (
          <div className="border rounded p-2 max-h-56 overflow-auto bg-white">
            {areaOpts.map((a) => {
              const active = areas.some((x) => String(x._id) === String(a._id));
              return (
                <button
                  key={a._id}
                  type="button"
                  className={`w-full text-left px-2 py-1 rounded hover:bg-gray-50 ${
                    active ? "bg-emerald-50" : ""
                  }`}
                  onClick={() => toggleArea(a)}
                  title={a.notes || ""}
                >
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-gray-600">
                    Code: {a.code || "—"} · Center:{" "}
                    {a.centerName ||
                      (a.center && typeof a.center === "object"
                        ? a.center.name
                        : a.center) ||
                      "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {areas.map((a) => (
              <span
                key={a._id}
                className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-sm"
              >
                {a.name || a._id}
                <button
                  type="button"
                  className="ml-1 text-red-600"
                  onClick={() => toggleArea({ _id: a._id })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Attachments</h3>
          <UploaderMini onDone={addFiles} />
        </div>

        {files.length === 0 ? (
          <div className="text-sm text-gray-500">No files added yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((f, i) => (
              <div
                key={`${f.url}-${i}`}
                className="border rounded p-3 flex items-center gap-3 bg-gray-50"
              >
                <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded bg-white border">
                  {f.thumbnailUrl || f.mime?.startsWith("image/") ? (
                    <img
                      src={f.thumbnailUrl || f.url}
                      alt={f.filename || "file"}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-500">PDF</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {f.filename || f.url?.split("/").pop()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {f.mime || "file"} ·{" "}
                    {Math.round(Number(f.size || 0) / 1024 || 0)} KB
                  </div>
                  <a
                    className="text-xs text-blue-600 underline"
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </div>
                <button
                  type="button"
                  className="text-xs border rounded px-2 py-1 hover:bg-red-50"
                  onClick={() => removeFileAt(i)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Committee Members (Excel) */}
      {committee?._id && (
        <div className="space-y-2 border-t pt-4 mt-4">
          <h3 className="font-medium">Bulk Committee Members (Excel)</h3>
          <p className="text-xs text-gray-600">
            Upload an Excel or CSV file with columns:{" "}
            <span className="font-mono">name</span>,{" "}
            <span className="font-mono">position</span>,{" "}
            <span className="font-mono">order</span>,{" "}
            <span className="font-mono">mobile</span>. All rows will be linked
            to this committee.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onImportChange}
              className="text-sm"
              disabled={importing}
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
                {importResult.dryRun
                  ? "Dry-run summary (no data saved yet)"
                  : "Import summary"}
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
                    Errors: {importResult.errors.length} (showing first few)
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
                    onClick={handleConfirmImport}
                    disabled={importing}
                  >
                    Confirm import
                  </button>
                  <span className="ml-2 text-[11px] text-emerald-900/80">
                    This will apply the above changes to the database.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Committee Members list + bulk delete */}
      {committee?._id && (
        <div className="space-y-2 border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Committee Members</h3>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              {membersLoading && <span>Loading members…</span>}
              {!membersLoading && (
                <span>
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {membersErr && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {membersErr}
            </div>
          )}

          {!membersLoading && !membersErr && members.length === 0 && (
            <div className="text-sm text-gray-500">
              No members linked to this committee yet.
            </div>
          )}

          {!membersLoading && members.length > 0 && (
            <>
              <div className="overflow-x-auto border rounded bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedMemberIds.length === members.length &&
                            members.length > 0
                          }
                          onChange={toggleSelectAllMembers}
                        />
                      </th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Position</th>
                      <th className="p-2 text-left">Mobile</th>
                      <th className="p-2 text-right">Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m._id} className="border-t">
                        <td className="p-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(m._id)}
                            onChange={() => toggleMemberSelection(m._id)}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <div className="font-medium">{m.name}</div>
                        </td>
                        <td className="p-2 align-top">
                          {m.position || m.designation || "—"}
                        </td>
                        <td className="p-2 align-top">
                          {m.phone || m.mobile || "—"}
                        </td>
                        <td className="p-2 align-top text-right">
                          {typeof m.order === "number" ? m.order : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-600">
                  Selected: {selectedMemberIds.length}
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-xs hover:bg-red-50 disabled:opacity-60"
                  onClick={handleDeleteSelectedMembers}
                  disabled={membersDeleting || selectedMemberIds.length === 0}
                >
                  {membersDeleting ? "Deleting…" : "Delete selected members"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving
            ? committee?._id
              ? "Saving…"
              : "Creating…"
            : committee?._id
            ? "Save Changes"
            : "Create Committee"}
        </button>
        <button
          type="button"
          className="border px-4 py-2 rounded"
          onClick={() =>
            committee?._id
              ? router.push(`/committees/${committee._id}`)
              : router.push(`/committees`)
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
