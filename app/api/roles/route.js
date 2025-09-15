// app/api/roles/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Role from "@/models/Role";

// GET /api/roles?q= &page=&limit=
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;
  console.log("params", params);

  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { permissions: rx }];
  }

  const [items, total] = await Promise.all([
    Role.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Role.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "manage_roles");

// POST /api/roles
// body: { name, permissions: string[] }
export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();

  const name = String(body?.name || "").trim();
  if (!name) {
    return new Response(JSON.stringify({ error: "Role name is required" }), {
      status: 400,
    });
  }
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.map(String)
    : [];

  const level = Number(body?.level || 100);

  const exists = await Role.findOne({ name }).lean();

  // if(level <= )

  if (exists) {
    return new Response(
      JSON.stringify({ error: "A role with this name already exists" }),
      { status: 409 }
    );
  }

  const role = await Role.create({ name, permissions });
  return Response.json(role);
}, "manage_roles");
