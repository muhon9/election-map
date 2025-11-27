// app/api/geo/route.js
import dbConnect from "@/lib/db";
import GeoUnit from "@/models/GeoUnit";
import { withPermApi } from "@/lib/rbac";

// GET /api/geo?type=&parentId=&q=&active=1
export const GET = withPermApi(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "").trim();
  const parentId = (searchParams.get("parentId") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const active = searchParams.get("active"); // "1" | "0" | null

  const filter = {};
  if (type) filter.type = type;
  if (parentId) filter.parent = parentId;
  if (active === "1") filter.active = true;
  if (active === "0") filter.active = false;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { code: rx }, { slug: rx }];
  }

  const items = await GeoUnit.find(filter)
    .sort({ sort: 1, name: 1 })
    .populate("parent")
    .lean();

  return Response.json({ items });
}, "*");

// POST /api/geo
// body: { type, name, parentId?, code?, sort?, active? }
export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();

  const type = String(body?.type || "").trim();
  const name = String(body?.name || "").trim();
  if (!type || !name) {
    return new Response(
      JSON.stringify({ error: "type and name are required" }),
      { status: 400 }
    );
  }

  const parentId = body?.parentId ? String(body.parentId) : null;
  const code = body?.code ? String(body.code) : "";
  const sort = Number.isFinite(Number(body?.sort)) ? Number(body.sort) : 0;
  const active = typeof body?.active === "boolean" ? body.active : true;

  const slug = GeoUnit.slugify(name);

  let parent = null;
  let ancestors = [];
  if (parentId) {
    parent = await GeoUnit.findById(parentId).lean();
    if (!parent)
      return new Response(JSON.stringify({ error: "Invalid parentId" }), {
        status: 400,
      });
    ancestors = [...(parent.ancestors || []), parent._id];
  }

  const exists = await GeoUnit.findOne({
    type,
    parent: parent?._id || null,
    slug,
  }).lean();
  if (exists) {
    return new Response(
      JSON.stringify({ error: "Duplicate: same type+parent+name exists" }),
      { status: 409 }
    );
  }

  const doc = await GeoUnit.create({
    type,
    name,
    slug,
    code,
    parent: parent?._id || null,
    ancestors,
    sort,
    active,
  });

  return Response.json(await GeoUnit.findById(doc._id).lean(), { status: 201 });
}, "manage_roles");
