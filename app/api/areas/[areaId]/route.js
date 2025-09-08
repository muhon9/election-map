import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Area from "@/models/Area";

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const updates = await req.json();

  // sanitize numerics
  for (const k of ["totalVoters", "maleVoters", "femaleVoters"]) {
    if (k in updates) {
      updates[k] = Number(updates[k]);
      if (Number.isNaN(updates[k]) || updates[k] < 0) {
        return new Response(
          JSON.stringify({ error: `${k} must be a non-negative number` }),
          { status: 400 }
        );
      }
    }
  }
  if ("name" in updates) updates.name = String(updates.name || "").trim();
  if ("code" in updates) updates.code = String(updates.code || "").trim();
  if ("notes" in updates) updates.notes = String(updates.notes || "").trim();

  const doc = await Area.findByIdAndUpdate(params.id, updates, {
    new: true,
  }).lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "edit_center");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Area.findByIdAndDelete(params.id);
  if (!r)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "delete_center");
