// app/api/users/[id]/route.js
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import bcrypt from "bcryptjs";
import { withPermApi } from "@/lib/rbac";

// GET /api/users/:id
export const GET = withPermApi(async (_req, { params }, session) => {
  await dbConnect();
  const actorLevel = session?.user?.roleLevel ?? 100;

  const user = await User.findById(params.id)
    .populate("role", "name permissions level")
    .lean();

  if (!user) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  const targetLevel =
    typeof user.role?.level === "number" ? user.role.level : 100;
  if (targetLevel < actorLevel) {
    return new Response(JSON.stringify({ error: "Insufficient level" }), {
      status: 403,
    });
  }

  user.password = undefined;
  return Response.json(user);
}, "manage_users");

// PATCH /api/users/:id
// body may include: { username?, email?, phone?, password?, roleId? }
export const PATCH = withPermApi(async (req, { params }, session) => {
  await dbConnect();
  console.log("triggered");
  const actorId = session?.user?.id;
  const actorLevel = session?.user?.roleLevel ?? 100;

  const target = await User.findById(params.id)
    .populate("role", "level")
    .lean();
  if (!target) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  const targetLevel =
    typeof target.role?.level === "number" ? target.role.level : 100;
  // You cannot modify a more powerful user
  if (targetLevel < actorLevel) {
    return new Response(
      JSON.stringify({ error: "Insufficient level to modify this user" }),
      { status: 403 }
    );
  }

  const body = await req.json();
  const updates = {};

  // Basic fields
  if (typeof body.username === "string")
    updates.username = body.username.trim();
  if (typeof body.email === "string") updates.email = body.email.trim();
  if (typeof body.phone === "string") updates.phone = body.phone.trim();

  // Password
  if (typeof body.password === "string") {
    const pw = body.password;
    if (pw.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400 }
      );
    }
    updates.password = await bcrypt.hash(pw, 10);
    updates.passwordChangedAt = new Date();
  }

  // Role change
  if (body.roleId) {
    // Prevent self role changes (defense-in-depth)
    if (actorId === target._id.toString()) {
      return new Response(
        JSON.stringify({ error: "You cannot change your own role" }),
        { status: 403 }
      );
    }

    const newRole = await Role.findById(body.roleId).lean();
    if (!newRole) {
      return new Response(JSON.stringify({ error: "Invalid roleId" }), {
        status: 400,
      });
    }

    // Cannot assign a role more powerful than yourself
    if (typeof newRole.level === "number" && newRole.level < actorLevel) {
      return new Response(
        JSON.stringify({ error: "Insufficient level to assign this role" }),
        { status: 403 }
      );
    }

    updates.role = newRole._id;
  }

  const updated = await User.findByIdAndUpdate(params.id, updates, {
    new: true,
  })
    .populate("role", "name permissions level")
    .lean();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  updated.password = undefined;
  return Response.json(updated);
}, "manage_users");

// DELETE /api/users/:id
export const DELETE = withPermApi(async (_req, { params }, session) => {
  await dbConnect();

  const actorId = session?.user?.id;
  const actorLevel = session?.user?.roleLevel ?? 100;

  // Don’t allow deleting yourself (optional but recommended)
  if (actorId === params.id) {
    return new Response(
      JSON.stringify({ error: "You cannot delete your own account" }),
      { status: 403 }
    );
  }

  const target = await User.findById(params.id)
    .populate("role", "level")
    .lean();
  if (!target) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  const targetLevel =
    typeof target.role?.level === "number" ? target.role.level : 100;
  if (targetLevel < actorLevel) {
    return new Response(
      JSON.stringify({ error: "Insufficient level to delete this user" }),
      { status: 403 }
    );
  }

  await User.findByIdAndDelete(params.id).lean();
  return Response.json({ ok: true });
}, "manage_users");
