"use client";

import { useState } from "react";

export default function UploaderMini({
  onDone,
  multiple = true,
  accept = "image/*,application/pdf",
  label = "Upload files",
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErr("");
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "Upload failed");
        setBusy(false);
        return;
      }
      // j.files => [{ url, filename, mime, size, thumbnailUrl }]
      onDone?.(j.files || []);
    } catch (e) {
      setErr("Network error");
    } finally {
      setBusy(false);
      // reset input so same file can be re-selected if needed
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <input
          type="file"
          className="hidden"
          id="uploader-mini-input"
          accept={accept}
          onChange={handleChange}
          multiple={multiple}
          disabled={disabled || busy}
        />
        <button
          type="button"
          onClick={() =>
            document.getElementById("uploader-mini-input")?.click()
          }
          disabled={disabled || busy}
          className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Choose files"}
        </button>
      </label>
      {err ? (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 px-2 py-1 rounded">
          {err}
        </div>
      ) : null}
    </div>
  );
}
