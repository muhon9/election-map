import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { withPermApi } from "@/lib/rbac";

export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const role = await Role.findById(params.id).lean();
  if (!role) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  return Response.json(role);
}, "manage_roles");

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const updates = await req.json();
  if (updates.permissions && !Array.isArray(updates.permissions)) {
    return new Response(JSON.stringify({ error: "permissions must be array" }), { status: 400 });
  }
  const role = await Role.findByIdAndUpdate(params.id, updates, { new: true }).lean();
  if (!role) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  return Response.json(role);
}, "manage_roles");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const res = await Role.findByIdAndDelete(params.id).lean();
  if (!res) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  return Response.json({ ok: true });
}, "manage_roles");
