// app/api/areas/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Area from "@/models/Area";
import mongoose from "mongoose";

const { Types } = mongoose;

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// GET /api/areas
// Supports:
//   ?q=searchText             (text search on name/code if text index exists; otherwise simple regex)
//   ?centerId=...             (filter by center)
//   ?page=1&limit=20
//   ?sort=name&dir=asc|desc
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  const page = Math.max(1, num(searchParams.get("page") || 1, 1));
  const limit = Math.min(
    200,
    Math.max(1, num(searchParams.get("limit") || 20, 20))
  );

  const sortField = (searchParams.get("sort") || "name").trim();
  const dir =
    (searchParams.get("dir") || "asc").toLowerCase() === "desc" ? -1 : 1;

  const q = (searchParams.get("q") || "").trim();
  const centerId = oid(searchParams.get("centerId"));

  const match = {};

  if (centerId) {
    // In Area schema this is usually `center`
    match.center = centerId;
  }

  let query = Area.find(match);

  // Text search or fallback regex on name/code
  if (q) {
    // If you have a text index on Area, you can use:
    //   match.$text = { $search: q }
    // and then query = Area.find(match).select({ score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } })
    //
    // For safety we'll use a simple case-insensitive regex over name + code
    const regex = new RegExp(q, "i");
    query = Area.find({
      ...match,
      $or: [{ name: regex }, { code: regex }],
    });
  }

  // Populate center so UI can show center name
  query = query
    .populate({ path: "center", select: "name" })
    .sort({ [sortField]: dir })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const [items, total] = await Promise.all([
    query.exec(),
    Area.countDocuments(
      q
        ? {
            ...match,
            $or: [{ name: new RegExp(q, "i") }, { code: new RegExp(q, "i") }],
          }
        : match
    ),
  ]);

  return Response.json({
    page,
    limit,
    total,
    items,
  });
}, "*");
