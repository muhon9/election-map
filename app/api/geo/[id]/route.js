// app/api/geo/[id]/route.js
import dbConnect from "@/lib/db";
import GeoUnit from "@/models/GeoUnit";
import { withPermApi } from "@/lib/rbac";

// PATCH /api/geo/:id
// body: { name?, code?, active?, sort?, parentId?, swapWithId? }
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  // --- Fast path: swap sort with sibling ---
  if (body.swapWithId) {
    const a = await GeoUnit.findById(params.id).lean();
    const b = await GeoUnit.findById(String(body.swapWithId)).lean();
    if (!a || !b) {
      return new Response(JSON.stringify({ error: "Item(s) not found" }), {
        status: 404,
      });
    }
    // must be same type & same parent to be siblings
    if (
      String(a.type) !== String(b.type) ||
      String(a.parent || "") !== String(b.parent || "")
    ) {
      return new Response(JSON.stringify({ error: "Not siblings" }), {
        status: 400,
      });
    }
    const aSort = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0;
    const bSort = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0;

    await GeoUnit.updateOne({ _id: a._id }, { $set: { sort: bSort } });
    await GeoUnit.updateOne({ _id: b._id }, { $set: { sort: aSort } });

    const [na, nb] = await Promise.all([
      GeoUnit.findById(a._id).lean(),
      GeoUnit.findById(b._id).lean(),
    ]);
    return Response.json({ ok: true, a: na, b: nb });
  }

  // --- Regular updates ---
  const set = {};
  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
      });
    }
    set.name = name;
    set.slug = GeoUnit.slugify(name);
  }
  if ("code" in body) set.code = String(body.code || "").trim();
  if ("active" in body) set.active = !!body.active;
  if ("sort" in body)
    set.sort = Number.isFinite(Number(body.sort)) ? Number(body.sort) : 0;

  // Re-parent (also recompute ancestors)
  if ("parentId" in body) {
    const parentId = body.parentId ? String(body.parentId) : null;
    let parentDoc = null;
    let ancestors = [];
    if (parentId) {
      parentDoc = await GeoUnit.findById(parentId).lean();
      if (!parentDoc) {
        return new Response(JSON.stringify({ error: "Invalid parentId" }), {
          status: 400,
        });
      }
      ancestors = [...(parentDoc.ancestors || []), parentDoc._id];
    }
    set.parent = parentDoc?._id || null;
    set.ancestors = ancestors;
  }

  const current = await GeoUnit.findById(params.id).lean();
  if (!current)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });

  // Uniqueness guard (type + parent + slug)
  const nextType = current.type;
  const nextParent = "parent" in set ? set.parent : current.parent;
  const nextSlug = "slug" in set ? set.slug : current.slug;
  const dup = await GeoUnit.findOne({
    _id: { $ne: current._id },
    type: nextType,
    parent: nextParent || null,
    slug: nextSlug,
  }).lean();
  if (dup) {
    return new Response(
      JSON.stringify({ error: "Duplicate under same parent/type" }),
      { status: 409 }
    );
  }

  const doc = await GeoUnit.findByIdAndUpdate(
    current._id,
    { $set: set },
    { new: true }
  ).lean();
  return Response.json(doc);
}, "manage_roles");

// DELETE /api/geo/:id
export const DELETE = withPermApi(async (req, { params }) => {
  await dbConnect();
  const current = await GeoUnit.findById(params.id).lean();
  if (!current)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });

  // Prevent deletion if has children
  const hasChildren = await GeoUnit.findOne({ parent: current._id }).lean();
  if (hasChildren) {
    return new Response(
      JSON.stringify({ error: "Has children, cannot delete" }),
      { status: 400 }
    );
  }

  await GeoUnit.deleteOne({ _id: current._id });
  return Response.json({ ok: true });
}, "manage_roles");

// GET /api/geo/:id
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();
  const doc = await GeoUnit.findById(params.id).lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "manage_roles");
