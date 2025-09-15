// app/api/roles/[id]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Role from "@/models/Role";
import User from "@/models/User";

// GET /api/roles/:id
// Only allow reading roles at or below your authority (level >= actorLevel)
export const GET = withPermApi(async (_req, { params }, session) => {
  await dbConnect();
  const actorLevel = session?.user?.roleLevel ?? 100;

  const doc = await Role.findById(params.id).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  if (typeof doc.level === "number" && doc.level < actorLevel) {
    return new Response(JSON.stringify({ error: "Insufficient level" }), {
      status: 403,
    });
  }
  return Response.json(doc);
}, "manage_roles");

// PATCH /api/roles/:id
// body: { name?, permissions?, level? }
// Rules:
//  - You cannot edit a role more powerful than you (role.level < actorLevel)
//  - You cannot set level to be more powerful than you (newLevel < actorLevel)
//  - Role name must remain unique
export const PATCH = withPermApi(async (req, { params }, session) => {
  await dbConnect();
  const actorLevel = session?.user?.roleLevel ?? 100;

  const role = await Role.findById(params.id);
  if (!role) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  if (role.level < actorLevel) {
    return new Response(
      JSON.stringify({ error: "Insufficient level to edit this role" }),
      { status: 403 }
    );
  }

  const body = await req.json();

  // Name
  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
      });
    }
    const exists = await Role.findOne({ name, _id: { $ne: role._id } }).lean();
    if (exists) {
      return new Response(
        JSON.stringify({ error: "Role name already in use" }),
        { status: 409 }
      );
    }
    role.name = name;
  }

  // Permissions
  if ("permissions" in body) {
    if (!Array.isArray(body.permissions)) {
      return new Response(
        JSON.stringify({ error: "permissions must be an array of strings" }),
        { status: 400 }
      );
    }
    role.permissions = body.permissions.map(String);
  }

  // Level
  if ("level" in body) {
    const newLevel = Number(body.level);
    if (!Number.isFinite(newLevel)) {
      return new Response(JSON.stringify({ error: "level must be a number" }), {
        status: 400,
      });
    }
    if (newLevel < actorLevel) {
      return new Response(
        JSON.stringify({ error: "Cannot set role level above your own" }),
        { status: 403 }
      );
    }
    role.level = newLevel;
  }

  await role.save();
  return Response.json({
    _id: role._id.toString(),
    name: role.name,
    permissions: role.permissions,
    level: role.level,
  });
}, "manage_roles");

// DELETE /api/roles/:id
// Rules:
//  - You cannot delete a role more powerful than you
//  - Prevent deleting a role that is still assigned to any users
export const DELETE = withPermApi(async (_req, { params }, session) => {
  await dbConnect();
  const actorLevel = session?.user?.roleLevel ?? 100;

  const role = await Role.findById(params.id);
  if (!role) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  if (role.level < actorLevel) {
    return new Response(
      JSON.stringify({ error: "Insufficient level to delete this role" }),
      { status: 403 }
    );
  }

  const inUse = await User.exists({ role: role._id });
  if (inUse) {
    return new Response(
      JSON.stringify({
        error: "Role is assigned to one or more users; reassign them first",
      }),
      { status: 409 }
    );
  }

  await Role.findByIdAndDelete(role._id);
  return Response.json({ ok: true });
}, "manage_roles");
