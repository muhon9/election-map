// app/api/committee-types/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import CommitteeType from "@/models/CommitteeType";

function S(v) {
  return v == null ? "" : String(v).trim();
}
function KEY(v) {
  return S(v).toUpperCase().replace(/\s+/g, "_");
}

export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  const q = S(searchParams.get("q"));
  const activeParam = searchParams.get("active"); // "1" | "0" | null
  const active =
    activeParam === null ? null : activeParam === "1" || activeParam === "true";

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const skip = (page - 1) * limit;

  const sortKey = S(searchParams.get("sort")) || "sort";
  const dir =
    (S(searchParams.get("dir")) || "asc").toLowerCase() === "desc" ? -1 : 1;

  const filter = {};
  if (active !== null) filter.active = active;

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { key: rx }, { description: rx }];
  }

  const sortStage = {};
  if (sortKey === "name") sortStage.name = dir;
  else if (sortKey === "key") sortStage.key = dir;
  else if (sortKey === "createdAt") sortStage.createdAt = dir;
  else sortStage.sort = dir;

  const total = await CommitteeType.countDocuments(filter);

  const items = await CommitteeType.find(filter)
    .sort(sortStage)
    .skip(skip)
    .limit(limit)
    .lean();

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "*"); // change perm if you want
// If you don't have manage_committees, use "*" or your existing permission string.
export const POST = withPermApi(async (req) => {
  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const name = S(body.name);
  const key = body.key ? KEY(body.key) : KEY(name);

  if (!name) {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
    });
  }
  if (!key) {
    return new Response(JSON.stringify({ error: "key is required" }), {
      status: 400,
    });
  }

  const exists = await CommitteeType.findOne({ key }).lean();
  if (exists) {
    return new Response(JSON.stringify({ error: "key already exists" }), {
      status: 409,
    });
  }

  const doc = await CommitteeType.create({
    key,
    name,
    description: S(body.description),
    color: S(body.color),
    sort: Number.isFinite(Number(body.sort)) ? Number(body.sort) : 0,
    active:
      body.active === undefined || body.active === null ? true : !!body.active,
  });

  return Response.json(doc);
}, "manage_roles");
