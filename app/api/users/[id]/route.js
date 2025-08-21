import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import bcrypt from "bcryptjs";
import { withPermApi } from "@/lib/rbac";

export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const user = await User.findById(params.id).populate("role", "name permissions").lean();
  if (!user) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  user.password = undefined;
  return Response.json(user);
}, "manage_users");

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const updates = {};

  if (typeof body.username === "string") updates.username = body.username;
  if (typeof body.email === "string") updates.email = body.email;
  if (typeof body.phone === "string") updates.phone = body.phone;

  if (typeof body.password === "string" && body.password.length >= 8) {
    updates.password = await bcrypt.hash(body.password, 10);
    updates.passwordChangedAt = new Date();
  }

  if (body.roleId) {
    const role = await Role.findById(body.roleId);
    if (!role) return new Response(JSON.stringify({ error: "Invalid roleId" }), { status: 400 });
    updates.role = role._id;
  }

  const user = await User.findByIdAndUpdate(params.id, updates, { new: true })
    .populate("role", "name permissions")
    .lean();

  if (!user) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  user.password = undefined;
  return Response.json(user);
}, "manage_users");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const res = await User.findByIdAndDelete(params.id).lean();
  if (!res) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  return Response.json({ ok: true });
}, "manage_users");
