// app/api/committees/[committeeId]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Committee from "@/models/Committee";
import Person from "@/models/Person";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateGeoChain } from "@/lib/geo-validate";
import Center from "@/models/Center"; // ✅ make sure Center is registered
import Area from "@/models/Area";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

const { Types } = mongoose;

// ---- shared helpers ----
function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}
function sanitizeFiles(files) {
  if (!Array.isArray(files)) return undefined; // undefined => no change
  return files
    .filter((f) => f && typeof f === "object")
    .map((f) => ({
      url: String(f.url || "").trim(),
      filename: String(f.filename || "").trim(),
      mime: String(f.mime || "").trim(),
      size: Number(f.size || 0),
      thumbnailUrl: String(f.thumbnailUrl || "").trim(),
      uploadedBy: oid(f.uploadedBy),
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : new Date(),
      docDate: f.docDate ? new Date(f.docDate) : null,
      source: String(f.source || "").trim(),
    }))
    .filter((f) => f.url);
}

// same uploader bits as list route
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "committees");
const MAX_BYTES = 10 * 1024 * 1024;
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
async function saveLocalFilesFromFormData(form) {
  const list = form.getAll("files") ?? [];
  if (!list.length) return [];

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const out = [];
  for (const file of list) {
    if (typeof file === "string") continue;
    const mime = file.type;
    const size = file.size ?? 0;
    const originalName = file.name || "upload";

    if (!ALLOWED.has(mime)) throw new Error(`Unsupported type: ${mime}`);
    if (size > MAX_BYTES)
      throw new Error(
        `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`
      );

    const buf = Buffer.from(await file.arrayBuffer());

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

    const url = `/uploads/committees/${filename}`;
    out.push({
      url,
      filename: originalName,
      mime,
      size,
      thumbnailUrl: mime.startsWith("image/") ? url : "",
    });
  }
  return out;
}

// ---------- GET /api/committees/:committeeId ----------
// app/api/committees/[committeeId]/route.js

export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params.committeeId;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  let doc = await Committee.findById(id)
    .populate({
      path: "cityId upazilaId unionId wardId",
      select: "name",
    })
    .populate({
      path: "areaId",
      select: "name", // 👈 we need center id here
    })
    .populate({
      path: "centers",
      select: "name",
    })
    .lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  // If doc doesn’t have centers but areaId has a center, fetch that center
  if (!doc.centers?.length && doc.areaId?.center) {
    const centerDoc = await Center.findById(doc.areaId.center)
      .select("name")
      .lean();

    if (centerDoc) {
      doc.centers = [centerDoc];
    }
  }

  return Response.json(doc);
}, "*");

// ---------- PATCH /api/committees/:committeeId ----------
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params.committeeId;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const contentType = req.headers.get("content-type") || "";
  const set = {};

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();

    if (form.has("name")) set.name = String(form.get("name") || "").trim();
    if (form.has("notes")) set.notes = String(form.get("notes") || "").trim();

    if (form.has("periodStart"))
      set["period.startDate"] = form.get("periodStart")
        ? new Date(form.get("periodStart"))
        : null;
    if (form.has("periodEnd"))
      set["period.endDate"] = form.get("periodEnd")
        ? new Date(form.get("periodEnd"))
        : null;

    // geo (validate if any present)
    const geoProvided =
      form.has("cityId") ||
      form.has("upazilaId") ||
      form.has("unionId") ||
      form.has("wardId");

    if (geoProvided) {
      const geo = {
        cityId: oid(form.get("cityId")?.toString() || null),
        upazilaId: oid(form.get("upazilaId")?.toString() || null),
        unionId: oid(form.get("unionId")?.toString() || null),
        wardId: oid(form.get("wardId")?.toString() || null),
      };
      try {
        await validateGeoChain(geo);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message || "Invalid geo chain" }),
          {
            status: 400,
          }
        );
      }
      set.cityId = geo.cityId;
      set.upazilaId = geo.upazilaId;
      set.unionId = geo.unionId;
      set.wardId = geo.wardId;
    }

    // centers (comma-separated)
    if (form.has("centers")) {
      const centersStr = form.get("centers")?.toString() || "";
      set.centers = centersStr
        ? centersStr
            .split(",")
            .map((s) => oid(s.trim()))
            .filter(Boolean)
        : [];
    }

    // If files were posted, replace files[] with newly saved ones
    const saved = await saveLocalFilesFromFormData(form);
    if (saved.length) {
      set.files = saved;
    }
  } else {
    // JSON patch
    const body = await req.json();

    if (typeof body.name === "string") set.name = body.name.trim();
    if (typeof body.notes === "string") set.notes = body.notes.trim();
    if (typeof body.ocrText === "string") set.ocrText = body.ocrText.trim();

    if (body.period) {
      set["period.startDate"] = body.period.startDate
        ? new Date(body.period.startDate)
        : null;
      set["period.endDate"] = body.period.endDate
        ? new Date(body.period.endDate)
        : null;
    }

    const geoProvided =
      "cityId" in body ||
      "upazilaId" in body ||
      "unionId" in body ||
      "wardId" in body;

    if (geoProvided) {
      const geo = {
        cityId: oid(body.cityId),
        upazilaId: oid(body.upazilaId),
        unionId: oid(body.unionId),
        wardId: oid(body.wardId),
      };
      try {
        await validateGeoChain(geo);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message || "Invalid geo chain" }),
          {
            status: 400,
          }
        );
      }
      set.cityId = geo.cityId;
      set.upazilaId = geo.upazilaId;
      set.unionId = geo.unionId;
      set.wardId = geo.wardId;
    }

    if ("centers" in body) {
      const centers = Array.isArray(body.centers)
        ? body.centers.map(oid).filter(Boolean)
        : [];
      set.centers = centers;
    }
    //if areaid is present
    if ("areaId" in body) {
      set.areaId = body.areaId ? oid(body.areaId) : null;
    }

    const files = sanitizeFiles(body.files);
    if (files !== undefined) set.files = files; // full replace
  }

  // (Optional) audit with session user
  await getServerSession(authOptions);

  const updated = await Committee.findByIdAndUpdate(
    id,
    { $set: set },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  return Response.json(updated);
}, "edit_center");

// ---------- DELETE /api/committees/:committeeId ----------
export const DELETE = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params.committeeId;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  // Delete the committee first
  const doc = await Committee.findByIdAndDelete(id).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  // Delete all persons that belong to this committee
  // (these are your committee members)
  await Person.deleteMany({ committeeId: doc._id });

  // (Optional) unlink or delete local files attached to the committee here

  return new Response(null, { status: 204 });
}, "delete_center");
