// app/api/uploads/route.js
// Minimal local uploader for PDFs and images (JPEG/PNG/WebP).
// Saves to /public/uploads/committees and returns URL + metadata.
//
// Notes:
// - This uses Request.formData() (no extra libs).
// - Ensure runtime is node (fs access).
// - Works only on a Node runtime (not Edge).
// - If you’re behind a reverse proxy, make sure the public URL maps to /public.

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "committees");

// 10 MB per file (adjust as needed)
const MAX_BYTES = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function randomName(ext = "") {
  const id = crypto.randomBytes(16).toString("hex");
  return ext ? `${id}.${ext}` : id;
}

function extFromName(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function POST(req) {
  try {
    const form = await req.formData();
    // Support single or multiple <input name="files">
    let files = form.getAll("files");
    if (!files || files.length === 0) {
      // also accept single "file" just in case
      const one = form.get("file");
      if (one) files = [one];
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // prep dir
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const saved = [];
    for (const file of files) {
      if (typeof file === "string") continue; // guard (should be a File)
      const mime = file.type;
      const size = file.size ?? 0;
      const originalName = file.name || "upload";

      if (!ALLOWED.has(mime)) {
        return NextResponse.json(
          { error: `Unsupported type: ${mime}` },
          { status: 400 }
        );
      }
      if (size > MAX_BYTES) {
        return NextResponse.json(
          {
            error: `File too large (max ${Math.round(
              MAX_BYTES / 1024 / 1024
            )} MB)`,
          },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());

      // use original extension if present, else derive from mime
      let ext = extFromName(originalName);
      if (!ext) {
        if (mime === "application/pdf") ext = "pdf";
        else if (mime === "image/jpeg") ext = "jpg";
        else if (mime === "image/png") ext = "png";
        else if (mime === "image/webp") ext = "webp";
      }

      const filename = randomName(ext);
      const filepath = path.join(UPLOAD_DIR, filename);

      await fs.writeFile(filepath, buf);

      // Public URL under /public
      const url = `/uploads/committees/${filename}`;

      saved.push({
        url,
        filename: originalName,
        mime,
        size,
        // You can set a thumbnail generator later; for now, leave empty or reuse the same for images:
        thumbnailUrl: mime.startsWith("image/") ? url : "",
      });
    }

    return NextResponse.json({ files: saved }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
