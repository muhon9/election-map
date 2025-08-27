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
  const body = await req.json();
  const name = (body.name || "").trim();
  if (!name)
    return new Response(JSON.stringify({ error: "name required" }), {
      status: 400,
    });

  // Coerce numbers (default 0), validate non-negative
  const totalVoters = Number(body.totalVoters ?? 0);
  const maleVoters = Number(body.maleVoters ?? 0);
  const femaleVoters = Number(body.femaleVoters ?? 0);
  for (const [k, v] of Object.entries({
    totalVoters,
    maleVoters,
    femaleVoters,
  })) {
    if (!Number.isFinite(v) || v < 0) {
      return new Response(
        JSON.stringify({ error: `${k} must be a non-negative number` }),
        { status: 400 }
      );
    }
  }

  const session = await getServerSession(authOptions);

  const doc = await Center.findByIdAndUpdate(
    params.id,
    {
      $push: {
        areas: {
          name,
          code: body.code || "",
          totalVoters,
          maleVoters,
          femaleVoters,
        },
      },
      $set: { updatedBy: session?.user?.id || null },
    },
    { new: true, projection: { areas: 1 } }
  ).lean();

  if (!doc)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });

  const areas = Array.isArray(doc.areas) ? doc.areas : [];
  const created = areas.length ? areas[areas.length - 1] : null;
  return Response.json(created ?? { ok: true });
}, "add_center");
