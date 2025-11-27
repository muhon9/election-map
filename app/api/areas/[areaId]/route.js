import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Area from "@/models/Area";

/**
 * GET /api/areas/:id
 * Returns the full Area document (lean).
 */
export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();

  const doc = await Area.findById(params.areaId).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  return Response.json(doc);
}, "*");

/**
 * PATCH /api/areas/:id
 * Updates allowed fields on the Area.
 */
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  // Build a sanitized $set payload (allow-list)
  const set = {};

  // Strings
  if ("name" in body) set.name = String(body.name || "").trim();
  if ("code" in body) set.code = String(body.code || "").trim();
  if ("notes" in body) set.notes = String(body.notes || "").trim();

  // Numeric voter fields (non-negative numbers)
  for (const k of ["totalVoters", "maleVoters", "femaleVoters"]) {
    if (k in body) {
      const v = Number(body[k]);
      if (Number.isNaN(v) || v < 0) {
        return new Response(
          JSON.stringify({ error: `${k} must be a non-negative number` }),
          { status: 400 }
        );
      }
      set[k] = v;
    }
  }

  // (Deliberately do NOT allow changing "center" here via PATCH)

  const doc = await Area.findByIdAndUpdate(
    params.areaId,
    { $set: set },
    { new: true, runValidators: true }
  ).lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  return Response.json(doc);
}, "edit_center");

/**
 * DELETE /api/areas/:id
 * Removes the Area.
 */
export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Area.findByIdAndDelete(params.areaId);
  if (!r) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  return Response.json({ ok: true });
}, "delete_center");
