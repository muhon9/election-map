import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  // Build a sanitized $set payload
  const set = {};

  // Primitive fields
  if (typeof body.name === "string") set.name = body.name;
  if (typeof body.address === "string") set.address = body.address;
  if ("lat" in body) set.lat = Number(body.lat);
  if ("lng" in body) set.lng = Number(body.lng);
  if ("notes" in body) set.notes = body.notes ?? "";

  // Voter counts (coerce to non-negative numbers)
  if ("totalVoters" in body) set.totalVoters = Number(body.totalVoters);
  if ("maleVoters" in body) set.maleVoters = Number(body.maleVoters);
  if ("femaleVoters" in body) set.femaleVoters = Number(body.femaleVoters);

  for (const k of ["lat", "lng", "totalVoters", "maleVoters", "femaleVoters"]) {
    if (k in set && (Number.isNaN(set[k]) || set[k] < 0)) {
      return new Response(
        JSON.stringify({ error: `${k} must be a non-negative number` }),
        { status: 400 }
      );
    }
  }

  // Map contactName/contactPhone -> nested contact fields
  if ("contactName" in body) set["contact.name"] = body.contactName ?? "";
  if ("contactPhone" in body) set["contact.phone"] = body.contactPhone ?? "";

  // Audit
  const session = await getServerSession(authOptions);
  set.updatedBy = session?.user?.id || null;

  const doc = await Center.findByIdAndUpdate(
    params.id,
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

// DELETE /api/centers/:id
export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Center.findByIdAndDelete(params.id);
  if (!r)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "delete_center");
