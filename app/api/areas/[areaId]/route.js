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
  const unset = {};

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

  // Shape (GeoJSON Polygon / MultiPolygon)
  if ("shape" in body) {
    const s = body.shape;

    // Clear shape
    if (s === null || s === undefined || s === "") {
      unset.shape = "";
    } else {
      const type = s.type;
      const coords = s.coordinates;

      if (!type || !["Polygon", "MultiPolygon"].includes(type)) {
        return new Response(
          JSON.stringify({
            error: "shape.type must be Polygon or MultiPolygon",
          }),
          { status: 400 }
        );
      }
      if (!Array.isArray(coords)) {
        return new Response(
          JSON.stringify({ error: "shape.coordinates must be an array" }),
          { status: 400 }
        );
      }

      set.shape = {
        type,
        coordinates: coords,
        ...(s.rawGeoJSON ? { rawGeoJSON: s.rawGeoJSON } : {}),
      };
    }
  }

  // Location (GeoJSON Point) - fallback marker when no polygon
  if ("location" in body) {
    const loc = body.location;

    // Clear location
    if (loc === null || loc === undefined || loc === "") {
      unset.location = "";
    } else {
      const type = loc.type;
      const coords = loc.coordinates;

      if (!type || type !== "Point") {
        return new Response(
          JSON.stringify({ error: "location.type must be Point" }),
          { status: 400 }
        );
      }

      if (
        !Array.isArray(coords) ||
        coords.length !== 2 ||
        !coords.every((n) => typeof n === "number" && Number.isFinite(n))
      ) {
        return new Response(
          JSON.stringify({
            error: "location.coordinates must be [lng, lat] as finite numbers",
          }),
          { status: 400 }
        );
      }

      set.location = {
        type: "Point",
        coordinates: coords,
      };
    }
  }

  // (Deliberately do NOT allow changing "center" here via PATCH)

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  const doc = await Area.findByIdAndUpdate(params.areaId, update, {
    new: true,
    runValidators: true,
  }).lean();

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
