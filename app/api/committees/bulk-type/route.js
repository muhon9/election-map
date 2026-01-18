// app/api/committees/bulk-type/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Committee from "@/models/Committee";
import CommitteeType from "@/models/CommitteeType";
import mongoose from "mongoose";

const { Types } = mongoose;

function oid(v) {
  if (!v) return null;
  const s = String(v);
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
}

function pickId(searchParams, keys) {
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") return v;
  }
  return null;
}

// GET: list committees (paginated) for selecting
export const GET = withPermApi(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();

  // Optional filters (same style you use elsewhere)
  const mode = (searchParams.get("mode") || "").toLowerCase(); // "city" | "rural" | ""
  const cityId = oid(pickId(searchParams, ["cityId", "city_corporation"]));
  const upazilaId = oid(pickId(searchParams, ["upazilaId", "upazila"]));
  const unionId = oid(pickId(searchParams, ["unionId", "union"]));
  const wardId = oid(pickId(searchParams, ["wardId", "ward"]));

  // Optional filter: only committees that currently have a type or a specific type
  const typeId = oid(searchParams.get("typeId"));
  const hasType = searchParams.get("hasType"); // "1" | "0" | ""

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const skip = (page - 1) * limit;

  // Sorting
  const sortKey = searchParams.get("sort") || "createdAt";
  const dirStr =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  const sortStage = {};
  if (sortKey === "name") sortStage.name = dirStr;
  else sortStage.createdAt = dirStr;

  // Guard: don’t allow city + upazila together (same rule you use)
  if (cityId && upazilaId) {
    return new Response(
      JSON.stringify({ error: "Provide either cityId OR upazilaId, not both" }),
      { status: 400 },
    );
  }

  const filter = {};

  if (mode === "city") {
    if (cityId) filter.cityId = cityId;
    if (wardId) filter.wardId = wardId;
  } else if (mode === "rural") {
    if (upazilaId) filter.upazilaId = upazilaId;
    if (unionId) filter.unionId = unionId;
    if (wardId) filter.wardId = wardId;
  } else {
    // no mode: still allow passing ids
    if (cityId) filter.cityId = cityId;
    if (upazilaId) filter.upazilaId = upazilaId;
    if (unionId) filter.unionId = unionId;
    if (wardId) filter.wardId = wardId;
  }

  // Search
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { notes: rx }, { ocrText: rx }];
  }

  // Type filters (committee.typeKey)
  if (typeId) {
    const t = await CommitteeType.findById(typeId, { key: 1 }).lean();
    if (!t) {
      return new Response(
        JSON.stringify({ error: "Committee type not found" }),
        {
          status: 404,
        },
      );
    }
    filter.typeKey = t.key;
  } else if (hasType === "1") {
    filter.typeKey = { $exists: true, $ne: "" };
  } else if (hasType === "0") {
    filter.$or = [
      { typeKey: { $exists: false } },
      { typeKey: null },
      { typeKey: "" },
    ];
  }

  const total = await Committee.countDocuments(filter);

  const items = await Committee.find(filter)
    .sort(sortStage)
    .skip(skip)
    .limit(limit)
    .populate("cityId upazilaId unionId wardId", "name type")
    .lean();

  const list = items.map((c) => ({
    _id: c._id,
    name: c.name,
    typeKey: c.typeKey || "",
    createdAt: c.createdAt,
    geo: {
      city: c.cityId ? { _id: c.cityId._id, name: c.cityId.name } : null,
      upazila: c.upazilaId
        ? { _id: c.upazilaId._id, name: c.upazilaId.name }
        : null,
      union: c.unionId ? { _id: c.unionId._id, name: c.unionId.name } : null,
      ward: c.wardId ? { _id: c.wardId._id, name: c.wardId.name } : null,
    },
  }));

  return Response.json({
    items: list,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "manage_roles");

// PATCH: bulk update type for selected committee IDs
export const PATCH = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json().catch(() => ({}));

  const ids = Array.isArray(body.ids) ? body.ids : [];
  const typeId = body.typeId;

  if (!ids.length) {
    return new Response(
      JSON.stringify({ error: "No committee IDs provided" }),
      {
        status: 400,
      },
    );
  }

  // validate ids
  const objIds = [];
  for (const id of ids) {
    const o = oid(id);
    if (!o) {
      return new Response(JSON.stringify({ error: `Invalid id: ${id}` }), {
        status: 400,
      });
    }
    objIds.push(o);
  }

  // allow clearing type with typeId = null
  let nextKey = "";
  let nextTypeId = null;

  if (typeId !== null && typeId !== "" && typeof typeId !== "undefined") {
    const tId = oid(typeId);
    if (!tId) {
      return new Response(JSON.stringify({ error: "typeId is invalid" }), {
        status: 400,
      });
    }

    const t = await CommitteeType.findById(tId, { key: 1, active: 1 }).lean();
    if (!t) {
      return new Response(
        JSON.stringify({ error: "Committee type not found" }),
        {
          status: 404,
        },
      );
    }

    nextKey = t.key;
    nextTypeId = tId; // ✅ store ObjectId in committee.typeId
  }

  // ✅ update both fields
  const update = {};
  if (nextTypeId) {
    update.$set = { typeId: nextTypeId, typeKey: nextKey };
    update.$unset = { typeId: "", typeKey: "" }; // safety cleanup not needed but harmless
    delete update.$unset; // keep it clean
  } else {
    update.$unset = { typeId: "", typeKey: "" }; // ✅ clear both
  }

  const res = await Committee.updateMany({ _id: { $in: objIds } }, update);

  return Response.json({
    ok: true,
    matched: res.matchedCount ?? res.n ?? 0,
    modified: res.modifiedCount ?? res.nModified ?? 0,
    typeId: nextTypeId ? String(nextTypeId) : null,
    typeKey: nextKey || "",
  });
}, "manage_roles");
