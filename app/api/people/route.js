// app/api/people/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Person, { PERSON_CATEGORIES } from "@/models/Person";
import mongoose from "mongoose";

const { Types } = mongoose;

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// GET /api/people
// Supports:
//   ?committeeId=...           (ObjectId)
//   ?category=COMMITTEE       (one of PERSON_CATEGORIES)
//   ?areaId=...               (ObjectId)
//   ?centerId=...             (ObjectId)
//   ?q=search text            (text search on name/designation/notes/tags)
//   ?page=1&limit=50
//   ?sort=order&dir=asc|desc
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  // Pagination & sorting
  const page = Math.max(1, num(searchParams.get("page") || 1, 1));
  const limit = Math.min(
    200,
    Math.max(1, num(searchParams.get("limit") || 50, 50))
  );
  const sortField = (searchParams.get("sort") || "createdAt").trim();
  const dir =
    (searchParams.get("dir") || "asc").toLowerCase() === "desc" ? -1 : 1;

  // Filters
  const committeeId = oid(searchParams.get("committeeId"));
  const areaId = oid(searchParams.get("areaId"));
  const centerId = oid(searchParams.get("centerId"));
  const category = (searchParams.get("category") || "").trim();
  const q = (searchParams.get("q") || "").trim();

  const match = {};

  if (committeeId) match.committeeId = committeeId;
  if (areaId) match.area = areaId;
  if (centerId) match.center = centerId;

  if (category) {
    // Only accept valid categories
    if (PERSON_CATEGORIES.includes(category)) {
      match.category = category;
    } else {
      return new Response(JSON.stringify({ error: "Invalid category value" }), {
        status: 400,
      });
    }
  }

  if (q) {
    // Uses text index from Person model:
    //   name, designation, notes, tags
    match.$text = { $search: q };
  }

  let query = Person.find(match);

  // Sorting
  if (q) {
    // If text search, you can sort by textScore + fallback sort
    query = query
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, [sortField]: dir });
  } else {
    query = query.sort({ [sortField]: dir });
  }

  // Pagination
  query = query.skip((page - 1) * limit).limit(limit);

  const [items, total] = await Promise.all([
    query
      .populate("area", "name")
      .populate("committeeId", "name")
      .lean()
      .exec(),
    Person.countDocuments(match),
  ]);

  return Response.json({
    page,
    limit,
    total,
    items,
  });
}, "*");
