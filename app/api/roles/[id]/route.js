// app/api/roles/[id]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Role from "@/models/Role";

// GET /api/roles/:id
export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const doc = await Role.findById(params.id).lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "manage_roles");

// PATCH /api/roles/:id
// body: { name?, permissions? }
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const set = {};

  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name)
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
      });

    const exists = await Role.findOne({ name, _id: { $ne: params.id } }).lean();
    if (exists)
      return new Response(
        JSON.stringify({ error: "Role name already in use" }),
        { status: 409 }
      );
    set.name = name;
  }

  if ("permissions" in body) {
    set.permissions = Array.isArray(body.permissions)
      ? body.permissions.map(String)
      : [];
  }

  const doc = await Role.findByIdAndUpdate(
    params.id,
    { $set: set },
    { new: true }
  ).lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "manage_roles");

// DELETE /api/roles/:id
export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Role.findByIdAndDelete(params.id);
  if (!r)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "manage_roles");
