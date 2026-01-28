"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UploaderMini from "@/components/UploaderMini";

async function fetchJSON(url, opts) {
  const r = await fetch(url, { cache: "no-store", ...(opts || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export default function AgentEditPage({ params }) {
  const router = useRouter();
  const agentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [agent, setAgent] = useState(null);

  const [form, setForm] = useState({
    name: "",
    areaName: "",
    mobile: "",
    nid: "",
    order: 0,
    image: { url: "", thumbnailUrl: "" },
  });

  function u(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function uImage(patch) {
    setForm((s) => ({
      ...s,
      image: { ...(s.image || {}), ...(patch || {}) },
    }));
  }

  // ---- load agent ----
  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const j = await fetchJSON(`/api/agents/${agentId}`);
        const a = j?.item || j;

        setAgent(a);
        setForm({
          name: a?.name || "",
          areaName: a?.areaName || "",
          mobile: a?.mobile || "",
          nid: a?.nid || "",
          order: Number(a?.order || 0),
          image: {
            url: a?.image?.url || "",
            thumbnailUrl: a?.image?.thumbnailUrl || "",
          },
        });
      } catch (e) {
        console.error(e);
        setErr(e.message || "Failed to load agent");
      } finally {
        setLoading(false);
      }
    })();
  }, [agentId]);

  // ---- uploader ----
  function onUploadDone(newOnes) {
    const first = Array.isArray(newOnes) ? newOnes[0] : null;
    if (!first?.url) return;

    // UploaderMini usually gives { url, thumbnailUrl, ... }
    uImage({
      url: first.url,
      thumbnailUrl: first.thumbnailUrl || "",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!agentId) return;

    setSaving(true);
    setErr("");

    try {
      const payload = {
        name: (form.name || "").trim(),
        areaName: (form.areaName || "").trim(),
        mobile: (form.mobile || "").trim(),
        nid: (form.nid || "").trim(),
        order: Number(form.order || 0),
        image: {
          url: (form.image?.url || "").trim(),
          thumbnailUrl: (form.image?.thumbnailUrl || "").trim(),
        },
      };

      const j = await fetchJSON(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updated = j?.item || j;
      setAgent(updated);
      router.refresh();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Loading agent…
      </div>
    );
  }

  if (err && !agent) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-red-700">
        {err}
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Agent not found.
      </div>
    );
  }

  const img = form.image?.thumbnailUrl || form.image?.url || "";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Agent</h1>
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
          onClick={() => router.back()}
          type="button"
        >
          ← Back
        </button>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded border bg-white p-4 space-y-5"
      >
        {/* Image */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-[220px]">
            <div className="text-xs font-medium text-gray-700 mb-1">
              Agent Image
            </div>

            <div className="border rounded bg-gray-50 p-3">
              <div className="w-full aspect-square rounded overflow-hidden bg-white border flex items-center justify-center">
                {img ? (
                  <img
                    src={img}
                    alt="agent"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-500">No image</span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <UploaderMini onDone={onUploadDone} />
                {(form.image?.url || form.image?.thumbnailUrl) && (
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded hover:bg-red-50 text-red-700 border-red-200"
                    onClick={() => uImage({ url: "", thumbnailUrl: "" })}
                  >
                    Remove
                  </button>
                )}
              </div>

              {form.image?.url && (
                <div className="mt-2 text-[11px] text-gray-500 break-all">
                  {form.image.url}
                </div>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.name}
                onChange={(e) => u("name", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Area Name
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.areaName}
                  onChange={(e) => u("areaName", e.target.value)}
                  placeholder="e.g., বুথ - ৪ / area name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Order (Serial)
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={form.order}
                  onChange={(e) => u("order", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mobile
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.mobile}
                  onChange={(e) => u("mobile", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  NID
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.nid}
                  onChange={(e) => u("nid", e.target.value)}
                  placeholder="NID number"
                />
              </div>
            </div>
          </div>
        </div>

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
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <button
            type="button"
            className="border px-4 py-2 rounded"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
