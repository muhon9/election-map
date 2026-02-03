import dbConnect from "@/lib/db";
import AgentGroup from "@/models/AgentGroup";
import Center from "@/models/Center";
import mongoose from "mongoose";
import { withPermApi } from "@/lib/rbac";
import Agent from "@/models/Agent";
const { Types } = mongoose;

/**
 * GET /api/agent-groups
 * Filters:
 *  - centerId
 *  - q
 *  - page, limit
 */
// app/api/agent-groups/route.js

// ---------- helpers ----------
function oid(v) {
  if (!v) return null;
  const s = String(v);
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
}
function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// ---------- GET /api/agent-groups ----------
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

  // geo params (same naming style as committees)
  const cityId = oid(
    searchParams.get("cityId") || searchParams.get("city_corporation"),
  );
  const upazilaId = oid(
    searchParams.get("upazilaId") || searchParams.get("upazila"),
  );
  const unionId = oid(searchParams.get("unionId") || searchParams.get("union"));
  const wardId = oid(searchParams.get("wardId") || searchParams.get("ward"));

  // direct center filter
  const centerId = oid(searchParams.get("centerId"));

  // Build AgentGroup match
  const match = {};
  const and = [];

  // text-ish search (regex like your bulk-type list)
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    and.push({ $or: [{ name: rx }, { notes: rx }] });
  }

  // Center resolution:
  // - if centerId provided => match.center = centerId
  // - else if any geo provided => find matching centers then match.center in those ids
  if (centerId) {
    and.push({ center: centerId });
  } else if (cityId || upazilaId || unionId || wardId) {
    const centerMatch = {};
    if (cityId) centerMatch.cityId = cityId;
    if (upazilaId) centerMatch.upazilaId = upazilaId;
    if (unionId) centerMatch.unionId = unionId;
    if (wardId) centerMatch.wardId = wardId;

    const centers = await Center.find(centerMatch).select("_id").lean();
    const centerIds = centers.map((c) => c._id);

    // If geo is provided but no centers match -> return empty list fast
    if (!centerIds.length) {
      return Response.json({ page, limit, total: 0, items: [] });
    }

    and.push({ center: { $in: centerIds } });
  }

  if (and.length) match.$and = and;

  const [items, total] = await Promise.all([
    AgentGroup.find(match)
      .sort({ [sort]: dir })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "center",
        select: "name cityId upazilaId unionId wardId",
        populate: [
          { path: "cityId", select: "name" },
          { path: "upazilaId", select: "name" },
          { path: "unionId", select: "name" },
          { path: "wardId", select: "name" },
        ],
      })
      .lean(),
    AgentGroup.countDocuments(match),
  ]);

  // ---- Attach peopleCount for each committee ----
  if (items.length > 0) {
    const agentGroupIds = items.map((c) => c._id);

    const counts = await Agent.aggregate([
      {
        $match: {
          agentGroupId: { $in: agentGroupIds },
        },
      },
      {
        $group: {
          _id: "$agentGroupId",
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

/**
 * POST /api/agent-groups
 */
export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();

  const name = (body.name || "").trim();
  const centerId = oid(body.centerId);
  const docLink = (body.docLink || "").trim();
  const notes = body.notes || "";

  if (!name) {
    return Response.json({ error: "Group name is required" }, { status: 400 });
  }
  if (!centerId) {
    return Response.json({ error: "centerId is required" }, { status: 400 });
  }

  const center = await Center.findById(centerId).select("_id");
  if (!center) {
    return Response.json({ error: "Center not found" }, { status: 404 });
  }

  const doc = await AgentGroup.create({
    name,
    center: centerId,
    notes,
    docLink,
  });

  return Response.json({ ok: true, item: doc });
}, "edit_center");
