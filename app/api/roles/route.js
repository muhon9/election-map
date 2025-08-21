import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { withPermApi } from "@/lib/rbac";

export const GET = withPermApi(async () => {
  await dbConnect();
  const roles = await Role.find({}).sort({ createdAt: -1 }).lean();
  return Response.json(roles);
}, "manage_roles");

export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.name || !Array.isArray(body.permissions)) {
    return new Response(JSON.stringify({ error: "name & permissions[] required" }), { status: 400 });
  }
  const role = await Role.create({ name: body.name, permissions: body.permissions });
  return Response.json(role);
}, "manage_roles");
