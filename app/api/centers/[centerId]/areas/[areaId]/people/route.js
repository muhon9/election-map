import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";

export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const c = await Center.findById(params.id, { areas: 1 }).lean();
  if (!c)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  const area = (c.areas || []).find((a) => String(a._id) === params.areaId);
  if (!area)
    return new Response(JSON.stringify({ error: "Area not found" }), {
      status: 404,
    });
  return Response.json(area.people || []);
}, "view_centers");

export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();
  const { name, phone, designation, importance, notes } = await req.json();
  if (!name)
    return new Response(JSON.stringify({ error: "name required" }), {
      status: 400,
    });

  const person = {
    name,
    phone: phone || "",
    designation: designation || "",
    importance: Number.isFinite(+importance) ? +importance : 0,
    notes: notes || "",
  };

  const r = await Center.updateOne(
    { _id: params.id, "areas._id": params.areaId },
    { $push: { "areas.$.people": person } }
  );

  if (!r.matchedCount)
    return new Response(JSON.stringify({ error: "Center or Area not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "add_center");
