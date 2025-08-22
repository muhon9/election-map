import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/centers/:id/areas  -> list areas
export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const c = await Center.findById(params.id, { areas: 1 }).lean();
  if (!c) {
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  }
  return Response.json(Array.isArray(c.areas) ? c.areas : []);
}, "view_centers");

// POST /api/centers/:id/areas  -> create area
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();
  const { name, code } = await req.json();
  if (!name) {
    return new Response(JSON.stringify({ error: "name required" }), {
      status: 400,
    });
  }

  const session = await getServerSession(authOptions);

  // Push the new area and return document with areas projected
  const doc = await Center.findByIdAndUpdate(
    params.id,
    {
      $push: { areas: { name, code: code || "" } },
      $set: { updatedBy: session?.user?.id || null },
    },
    {
      new: true,
      projection: { areas: 1 }, // <-- use projection (not fields)
    }
  ).lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  }

  const areas = Array.isArray(doc.areas) ? doc.areas : [];
  const created = areas.length ? areas[areas.length - 1] : null;

  // If for some reason projection didn’t include it, fall back to returning ok
  if (!created) {
    return Response.json({ ok: true });
  }
  return Response.json(created);
}, "add_center");
