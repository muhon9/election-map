// app/api/roles/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Role from "@/models/Role";

// GET /api/roles?q=&page=&limit=
// Only returns roles the actor can see/assign (level >= actorLevel)
export const GET = withPermApi(async (req, { params }, session) => {
  await dbConnect();

  const actorLevel = session?.user?.roleLevel ?? 100;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  // Base filter: only roles at or below your authority (numerically >= your level)
  const filter = { level: { $gte: actorLevel } };

  if (q) {
    // case-insensitive safe regex on name or permissions
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { permissions: rx }];
  }

  const [items, total] = await Promise.all([
    Role.find(filter)
      .sort({ level: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Role.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "manage_users");

// POST /api/roles
// body: { name: string, permissions: string[], level: number }
// Cannot create a role more powerful than yourself (i.e., with level < actorLevel)
export const POST = withPermApi(async (req, _ctx, session) => {
  await dbConnect();
  const actorLevel = session?.user?.roleLevel ?? 100;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.map(String)
    : [];
  const hasLevel = body?.level !== undefined && body?.level !== null;
  const level = hasLevel ? Number(body.level) : 100;

  if (!name) {
    return new Response(JSON.stringify({ error: "Role name is required" }), {
      status: 400,
    });
  }
  if (!Array.isArray(permissions)) {
    return new Response(
      JSON.stringify({ error: "permissions must be an array of strings" }),
      { status: 400 }
    );
  }
  if (!Number.isFinite(level)) {
    return new Response(JSON.stringify({ error: "level must be a number" }), {
      status: 400,
    });
  }

  // Enforce hierarchy: you cannot create a role that is more powerful than you
  if (level < actorLevel) {
    return new Response(
      JSON.stringify({ error: "Insufficient level to create this role" }),
      { status: 403 }
    );
  }

  const exists = await Role.findOne({ name }).lean();
  if (exists) {
    return new Response(
      JSON.stringify({ error: "A role with this name already exists" }),
      { status: 409 }
    );
  }

  const role = await Role.create({ name, permissions, level });
  return Response.json(role, { status: 201 });
}, "manage_roles");
