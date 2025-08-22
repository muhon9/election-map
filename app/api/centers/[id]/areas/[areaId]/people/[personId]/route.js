import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  const set = {};
  if ("name" in body) set["areas.$[a].people.$[p].name"] = body.name;
  if ("phone" in body) set["areas.$[a].people.$[p].phone"] = body.phone || "";
  if ("designation" in body)
    set["areas.$[a].people.$[p].designation"] = body.designation || "";
  if ("importance" in body) {
    const imp = Number(body.importance);
    if (!Number.isFinite(imp) || imp < 0 || imp > 10)
      return new Response(JSON.stringify({ error: "importance 0-10" }), {
        status: 400,
      });
    set["areas.$[a].people.$[p].importance"] = imp;
  }
  if ("notes" in body) set["areas.$[a].people.$[p].notes"] = body.notes || "";

  const r = await Center.updateOne(
    { _id: params.id },
    { $set: set },
    { arrayFilters: [{ "a._id": params.areaId }, { "p._id": params.personId }] }
  );

  if (!r.matchedCount)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  if (!r.modifiedCount)
    return new Response(
      JSON.stringify({ error: "Area/Person not found or no change" }),
      { status: 404 }
    );
  return Response.json({ ok: true });
}, "edit_center");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Center.updateOne(
    { _id: params.id, "areas._id": params.areaId },
    { $pull: { "areas.$.people": { _id: params.personId } } }
  );

  if (!r.matchedCount)
    return new Response(JSON.stringify({ error: "Center or Area not found" }), {
      status: 404,
    });
  if (!r.modifiedCount)
    return new Response(JSON.stringify({ error: "Person not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "delete_center");
