// app/api/mosqs/[id]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Mosq from "@/models/Mosq";
import Center from "@/models/Center";
import Area from "@/models/Area";
import GeoUnit from "@/models/GeoUnit";

import { validateGeoChain } from "@/lib/geo-validate";

// GET /api/mosqs/:id
export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const doc = await Mosq.findById(params.id)
    .populate("center", "name")
    .populate("area", "name")
    .lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "view_centers");

// PATCH /api/mosqs/:id
// body: { name?, address?, upazilla?, ward?, contact?, centerId?, areaId?, location?: {lat,lng}? }
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const current = await Mosq.findById(params.id).lean();
  if (!current)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });

  const next = {
    name: "name" in body ? String(body.name || "").trim() : current.name,
    address:
      "address" in body ? String(body.address || "").trim() : current.address,
    cityId: "cityId" in body ? body.cityId || null : current.cityId,
    upazillaId:
      "upazillaId" in body ? body.upazillaId || null : current.upazillaId,
    unionId: "unionId" in body ? body.unionId || null : current.unionId,
    wardId: "wardId" in body ? body.wardId || null : current.wardId,
    contact:
      "contact" in body ? String(body.contact || "").trim() : current.contact,
    location: {
      lat: Number(body?.location?.lat ?? current.location?.lat ?? 0) || 0,
      lng: Number(body?.location?.lng ?? current.location?.lng ?? 0) || 0,
    },
  };

  try {
    await validateGeoChain({
      cityId: next.cityId,
      upazillaId: next.upazillaId,
      unionId: next.unionId,
      wardId: next.wardId,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }

  const updated = await Mosq.findByIdAndUpdate(
    params.id,
    { $set: next },
    { new: true }
  ).lean();
  return Response.json(updated);
}, "view_centers");

// DELETE /api/mosqs/:id
export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const res = await Mosq.findByIdAndDelete(params.id).lean();
  if (!res)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "view_centers");
