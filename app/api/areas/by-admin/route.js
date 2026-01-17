// app/api/areas/by-admin/route.js
import dbConnect from "@/lib/db";
import Area from "@/models/Area";
import Center from "@/models/Center";
import { withPermApi } from "@/lib/rbac";
import mongoose from "mongoose";

const { Types } = mongoose;

function oid(v) {
  if (!v) return null;
  const s = String(v);
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
}

export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  // mode is optional; we mainly use the ids
  const mode = (searchParams.get("mode") || "").toLowerCase(); // "city" | "rural" | ""
  const q = (searchParams.get("q") || "").trim();

  // Admin filters (support both naming styles)
  const cityId = oid(
    searchParams.get("cityId") || searchParams.get("city_corporation"),
  );
  const upazilaId = oid(
    searchParams.get("upazilaId") || searchParams.get("upazila"),
  );
  const unionId = oid(searchParams.get("unionId") || searchParams.get("union"));
  const wardId = oid(searchParams.get("wardId") || searchParams.get("ward"));

  // Optional direct center filter
  const centerId = oid(
    searchParams.get("centerId") || searchParams.get("center"),
  );

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
  );
  const skip = (page - 1) * limit;

  // Sorting (match your list conventions)
  const sortKey = searchParams.get("sort") || "createdAt";
  const dirStr =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  const sortStage = {};
  if (sortKey === "name") sortStage.name = dirStr;
  else if (sortKey === "totalVoters") sortStage.totalVoters = dirStr;
  else sortStage.createdAt = dirStr;

  // Guard: Do not allow mixing top-level city + upazila at once
  if (cityId && upazilaId) {
    return new Response(
      JSON.stringify({ error: "Provide either cityId OR upazilaId, not both" }),
      { status: 400 },
    );
  }

  // 1) Build center filter from admin filters
  // If nothing provided (no cityId/mode/etc.), centerFilter stays {} => matches ALL centers
  const centerFilter = {};

  if (centerId) {
    centerFilter._id = centerId;
  } else {
    if (cityId) centerFilter.cityId = cityId;
    if (upazilaId) centerFilter.upazilaId = upazilaId;
    if (unionId) centerFilter.unionId = unionId;
    if (wardId) centerFilter.wardId = wardId;

    // mode is not required; it's informational
    if (mode === "city") {
      // no-op
    } else if (mode === "rural") {
      // no-op
    }
  }

  // 2) Find matching center IDs (if centerFilter is {}, this returns all centers)
  const centerIds = await Center.find(centerFilter, { _id: 1, name: 1 }).lean();
  const matchedCenterIds = centerIds.map((x) => x._id);

  // If there are no centers at all, return empty
  if (!matchedCenterIds.length) {
    return Response.json({
      items: [],
      total: 0,
      page,
      pageSize: limit,
      pages: 1,
      centersMatched: 0,
      filters: {
        mode: mode || null,
        centerId: centerId?.toString() || null,
        cityId: cityId?.toString() || null,
        upazilaId: upazilaId?.toString() || null,
        unionId: unionId?.toString() || null,
        wardId: wardId?.toString() || null,
        q: q || "",
      },
    });
  }

  // 3) Build area filter (center IN matchedCenterIds) + search
  const areaFilter = { center: { $in: matchedCenterIds } };

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // also allow searching by center name within matched set
    const centerIdsFromName = await Center.find(
      { _id: { $in: matchedCenterIds }, name: rx },
      { _id: 1 },
    )
      .lean()
      .then((arr) => arr.map((x) => x._id));

    areaFilter.$or = [
      { name: rx },
      { code: rx },
      { notes: rx },
      ...(centerIdsFromName.length
        ? [{ center: { $in: centerIdsFromName } }]
        : []),
    ];
  }

  // 4) Count + list (populate center name)
  const total = await Area.countDocuments(areaFilter);

  const items = await Area.find(areaFilter)
    .sort(sortStage)
    .skip(skip)
    .limit(limit)
    .populate("center", "name cityId upazilaId unionId wardId")
    .lean();

  const list = items.map((a) => ({
    _id: a._id,
    name: a.name,
    code: a.code || "",
    location: a.location || null,
    notes: a.notes || "",
    totalVoters: a.totalVoters ?? 0,
    maleVoters: a.maleVoters ?? 0,
    femaleVoters: a.femaleVoters ?? 0,
    createdAt: a.createdAt,
    center: a.center
      ? { _id: a.center._id, name: a.center.name }
      : { _id: a.center, name: "" },
  }));

  return Response.json({
    items: list,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    centersMatched: matchedCenterIds.length,
    filters: {
      mode: mode || null,
      centerId: centerId?.toString() || null,
      cityId: cityId?.toString() || null,
      upazilaId: upazilaId?.toString() || null,
      unionId: unionId?.toString() || null,
      wardId: wardId?.toString() || null,
      q: q || "",
    },
  });
}, "*");
