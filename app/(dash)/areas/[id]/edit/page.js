"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import PeopleEditor from "@/components/PeopleEditor";

export default function AreaEditPage() {
  const { id } = useParams(); // /areas/[id]/edit
  const router = useRouter();
  const sp = useSearchParams();

  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  const [area, setArea] = useState(null);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    code: "",
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
    notes: "",
  });

  // Selected People tab (URL-driven and reactive)
  const tabParam = (sp.get("tab") || sp.get("add") || "").toUpperCase();
  const validTabs = ["COMMITTEE", "RENOWNED", "CONTACT"];
  const [peopleTab, setPeopleTab] = useState(
    validTabs.includes(tabParam) ? tabParam : "COMMITTEE"
  );
  useEffect(() => {
    const t = (sp.get("tab") || sp.get("add") || "").toUpperCase();
    if (validTabs.includes(t)) setPeopleTab(t);
  }, [sp]);

  // Area Info collapse/expand
  const [areaOpen, setAreaOpen] = useState(false);
  const areaRef = useRef(null);
  function toggleArea() {
    setAreaOpen((o) => {
      const next = !o;
      if (next) {
        setTimeout(() => {
          areaRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 0);
      }
      return next;
    });
  }

  // Load area
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/areas/${id}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load area");
        setArea(j);
        setForm({
          name: j.name || "",
          code: j.code || "",
          totalVoters: j.totalVoters ?? "",
          maleVoters: j.maleVoters ?? "",
          femaleVoters: j.femaleVoters ?? "",
          notes: j.notes || "",
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load area");
        setArea(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load parent center (for header links)
  useEffect(() => {
    if (!area?.center) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/centers/${area.center}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!alive) return;
        if (res.ok) setCenter(j);
      } catch {
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [area?.center]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canEdit) return;

    const payload = {
      name: (form.name || "").trim(),
      code: (form.code || "").trim(),
      totalVoters: Number(form.totalVoters || 0),
      maleVoters: Number(form.maleVoters || 0),
      femaleVoters: Number(form.femaleVoters || 0),
      notes: (form.notes || "").trim(),
    };

    // Soft validation
    if (payload.totalVoters < payload.maleVoters + payload.femaleVoters) {
      const ok = confirm("Total voters is less than Male + Female. Continue?");
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/areas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to update area");
        return;
      }
      setArea(j);
      // sync
      setForm({
        name: j.name || "",
        code: j.code || "",
        totalVoters: j.totalVoters ?? "",
        maleVoters: j.maleVoters ?? "",
        femaleVoters: j.femaleVoters ?? "",
        notes: j.notes || "",
      });
      alert("Area updated.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!canDelete) return;
    if (!confirm("Delete this area? This cannot be undone.")) return;
    const res = await fetch(`/api/areas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete area");
      return;
    }
    if (center?._id) router.push(`/centers/${center._id}`);
    else router.push("/centers");
  }

  const headerSubtitle = useMemo(() => {
    if (!center) return null;
    return (
      <div className="text-sm text-gray-600">
        In center:{" "}
        <a className="text-blue-600 underline" href={`/centers/${center._id}`}>
          {center.name}
        </a>
        {area?.code && (
          <span className="ml-2 text-gray-500">• Code: {area.code}</span>
        )}
      </div>
    );
  }, [center, area?.code]);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
            onClick={() => router.back()}
          >
            ← Back
          </button>
          <a className="text-sm text-blue-600 underline" href="/centers">
            All centers
          </a>
          {center?._id && (
            <a
              className="text-sm text-blue-600 underline"
              href={`/centers/${center._id}`}
            >
              Parent center
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              className="px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Heading */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {loading ? "Loading…" : area?.name || "Edit Area"}
          </h1>
          {headerSubtitle}
        </div>
      </header>

      {/* Error / Loading */}
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading area…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Content */}
      {!loading && !err && area && (
        <>
          {/* AREA INFO (collapsible) */}
          <section ref={areaRef} className="rounded border bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-base font-semibold">Area Info</h2>
              <button
                type="button"
                className="text-sm text-blue-700 underline"
                onClick={toggleArea}
                title={areaOpen ? "Collapse Area Info" : "Expand Area Info"}
              >
                {areaOpen ? "Collapse ↑" : "Expand ↓"}
              </button>
            </div>

            {areaOpen && (
              <div className="p-4">
                <form
                  onSubmit={onSubmit}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Area Name
                    </label>
                    <input
                      className="border rounded w-full px-3 py-2"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      className="border rounded w-full px-3 py-2"
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-1"></div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.totalVoters}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, totalVoters: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Male Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.maleVoters}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, maleVoters: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Female Voters
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded w-full px-3 py-2"
                      value={form.femaleVoters}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, femaleVoters: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      className="border rounded w-full px-3 py-2"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center gap-2">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={!canEdit || saving}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 border rounded hover:bg-gray-50"
                      onClick={() => router.back()}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          {/* PEOPLE MANAGEMENT (always open) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">People</h2>
              {/* <div className="inline-flex rounded border overflow-hidden">
                {["COMMITTEE", "RENOWNED", "CONTACT"].map((tab) => (
                  <button
                    key={tab}
                    className={`px-3 py-1.5 text-sm ${
                      peopleTab === tab
                        ? "bg-blue-600 text-white"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setPeopleTab(tab)}
                  >
                    {tab === "COMMITTEE"
                      ? "Committee"
                      : tab === "RENOWNED"
                      ? "Important"
                      : "Contacts"}
                  </button>
                ))}
              </div> */}
            </div>

            <div className="rounded border bg-white p-3">
              {/* Committee: hide designation + order fields per your request */}
              <PeopleEditor
                areaId={String(id)}
                defaultCategory={peopleTab}
                hideCommitteeDesignation
                hideCommitteeOrder
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
