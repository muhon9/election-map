// app/api/committees/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Committee from "@/models/Committee";
import mongoose from "mongoose";
import { validateGeoChain } from "@/lib/geo-validate";
import Person from "@/models/Person";
import Area from "@/models/Area";
import Center from "@/models/Center";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs"; // needed for fs

const { Types } = mongoose;

// ---------- helpers ----------
function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}
function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function sanitizeFiles(files) {
  if (!Array.isArray(files)) return [];
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

// ---- local upload (same logic as /api/uploads) ----
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
/**
 * Saves files from a multipart formData under the "files" field.
 * Returns the same structure as /api/uploads -> { url, filename, mime, size, thumbnailUrl }[]
 */
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

    if (!ALLOWED.has(mime)) {
      throw new Error(`Unsupported type: ${mime}`);
    }
    if (size > MAX_BYTES) {
      throw new Error(
        `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`,
      );
    }

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

// ---------- GET /api/committees (list) ----------
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  // Pagination & sorting
  const page = Math.max(1, num(searchParams.get("page") || 1));
  const limit = Math.min(
    200,
    Math.max(1, num(searchParams.get("limit") || 20)),
  );
  const sort = (searchParams.get("sort") || "createdAt").trim();
  const dir =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  // Filters
  const q = (searchParams.get("q") || "").trim();
  const cityId = oid(
    searchParams.get("cityId") || searchParams.get("city_corporation"),
  );
  const areaId = oid(searchParams.get("areaId"));
  const upazilaId = oid(
    searchParams.get("upazilaId") || searchParams.get("upazila"),
  );
  const unionId = oid(searchParams.get("unionId") || searchParams.get("union"));
  const wardId = oid(searchParams.get("wardId") || searchParams.get("ward"));
  const centerId = oid(searchParams.get("centerId"));

  // ✅ Committee type filter (support multiple naming styles)
  const typeId = oid(
    searchParams.get("typeId") ||
      searchParams.get("committeeTypeId") ||
      searchParams.get("committeeType"),
  );

  const match = {};
  const orConditions = [];

  if (cityId) match.cityId = cityId;
  if (upazilaId) match.upazilaId = upazilaId;
  if (unionId) match.unionId = unionId;
  if (wardId) match.wardId = wardId;
  if (q) match.$text = { $search: q };

  // ✅ apply type filter (does NOT affect existing behavior when not provided)
  if (typeId) match.typeId = typeId;

  // 🔹 Area filter: committees linked to this area (new areas[] or legacy areaId)
  if (areaId) {
    orConditions.push(
      { areas: areaId }, // new multi-area field
      { areaId: areaId }, // legacy single-area field
    );
  }

  // 🔹 Center filter: committees linked directly OR via areas of that center
  if (centerId) {
    const areas = await Area.find({ center: centerId }).select("_id").lean();
    const areaIds = areas.map((a) => a._id);

    if (areaIds.length) {
      orConditions.push(
        { centers: centerId }, // directly attached to center
        { areas: { $in: areaIds } }, // any of its areas attached
        { areaId: { $in: areaIds } }, // legacy areaId pointing to those areas
      );
    } else {
      // no areas for this center, fallback to only direct center match
      orConditions.push({ centers: centerId });
    }
  }

  // If we have any OR conditions, attach them to match
  if (orConditions.length) {
    match.$or = orConditions;
  }

  let cursor = Committee.find(match)
    .sort({
      [q ? "score" : sort]: q ? { $meta: "textScore" } : dir,
      ...(q ? { [sort]: dir } : {}),
    })
    .skip((page - 1) * limit)
    .limit(limit)
    // populate centers & areas for display
    .populate({ path: "centers", select: "name" })
    .populate({
      path: "areas",
      select: "name center",
      populate: { path: "center", select: "name" },
    })
    .lean();

  if (q) {
    cursor = cursor.select({ score: { $meta: "textScore" } });
  }

  const [items, total] = await Promise.all([
    cursor.exec(),
    Committee.countDocuments(match),
  ]);

  // ---- Attach peopleCount for each committee ----
  if (items.length > 0) {
    const committeeIds = items.map((c) => c._id);

    const counts = await Person.aggregate([
      {
        $match: {
          category: "COMMITTEE",
          committeeId: { $in: committeeIds },
        },
      },
      {
        $group: {
          _id: "$committeeId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    for (const c of items) {
      c.peopleCount = countMap.get(String(c._id)) || 0;
    }
  }

  return Response.json({ page, limit, total, items });
}, "*");

// ---------- POST /api/committees (create) ----------
export const POST = withPermApi(async (req) => {
  await dbConnect();

  // Support BOTH:
  // - JSON body with files[] (uploaded earlier via /api/uploads)
  // - multipart/form-data with files field (we'll save locally here)
  const contentType = req.headers.get("content-type") || "";

  let body = {};
  let incomingFiles = [];

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();

    // basic fields
    body.name = (form.get("name") || "").toString();
    body.notes = (form.get("notes") || "").toString();
    body.period = {
      startDate: form.get("periodStart")
        ? new Date(form.get("periodStart"))
        : null,
      endDate: form.get("periodEnd") ? new Date(form.get("periodEnd")) : null,
    };

    // geo ids
    body.cityId = form.get("cityId")?.toString() || null;
    body.upazilaId = form.get("upazilaId")?.toString() || null;
    body.unionId = form.get("unionId")?.toString() || null;
    body.wardId = form.get("wardId")?.toString() || null;

    // centers (optional, comma-separated)
    const centersStr = form.get("centers")?.toString() || "";
    body.centers = centersStr
      ? centersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // 🔹 areas (optional, comma-separated) – new multi-areas support
    const areasStr = form.get("areas")?.toString() || "";
    body.areas = areasStr
      ? areasStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // legacy single areaId (if posted from old client)
    body.areaId = form.get("areaId")?.toString() || null;

    // save files locally (same output shape as /api/uploads)
    incomingFiles = await saveLocalFilesFromFormData(form);
  } else {
    body = await req.json();
    incomingFiles = sanitizeFiles(body.files); // from /api/uploads response
  }

  // required
  if (!body?.name || typeof body.name !== "string") {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
    });
  }

  // geo validation (nullable accepted)
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
      },
    );
  }

  // centers
  const centers = Array.isArray(body.centers)
    ? body.centers.map(oid).filter(Boolean)
    : [];

  // 🔹 areas + legacy areaId handling
  let areas = Array.isArray(body.areas)
    ? body.areas.map(oid).filter(Boolean)
    : [];

  let areaId = null;

  if (body.areaId) {
    if (!Types.ObjectId.isValid(body.areaId)) {
      return new Response(JSON.stringify({ error: "Invalid areaId" }), {
        status: 400,
      });
    }
    areaId = oid(body.areaId);

    // if old client only sent areaId (and no areas[]), sync areas from it
    if (!areas.length && areaId) {
      areas = [areaId];
    }
  } else if (areas.length) {
    // if only areas[] is provided, keep areaId in sync as first area
    areaId = areas[0];
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? new Types.ObjectId(session.user.id) : null;

  const doc = await Committee.create({
    name: body.name.trim(),
    notes: (body.notes || "").trim(),
    ocrText: (body.ocrText || "").trim(),
    period: {
      startDate: body?.period?.startDate ?? null,
      endDate: body?.period?.endDate ?? null,
    },
    ...geo,
    centers,
    // 🔹 new multi-areas + legacy single areaId
    areas,
    areaId,
    files: (incomingFiles || []).map((f) => ({
      ...f,
      uploadedBy: f.uploadedBy || userId,
      uploadedAt: f.uploadedAt || new Date(),
    })),
  });

  return new Response(JSON.stringify(doc), { status: 201 });
}, "add_center");
