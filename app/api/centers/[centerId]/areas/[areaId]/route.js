import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const set = {};

  if ("name" in body) set["areas.$[a].name"] = body.name || "";
  if ("code" in body) set["areas.$[a].code"] = body.code || "";

  const numbers = ["totalVoters", "maleVoters", "femaleVoters"];
  for (const k of numbers) {
    if (k in body) {
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < 0) {
        return new Response(
          JSON.stringify({ error: `${k} must be a non-negative number` }),
          { status: 400 }
        );
      }
      set[`areas.$[a].${k}`] = v;
    }
  }

  const session = await getServerSession(authOptions);

  const r = await Center.updateOne(
    { _id: params.id },
    { $set: { ...set, updatedBy: session?.user?.id || null } },
    { arrayFilters: [{ "a._id": params.areaId }] }
  );

  if (!r.matchedCount)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  if (!r.modifiedCount)
    return new Response(
      JSON.stringify({ error: "Area not found or no change" }),
      { status: 404 }
    );
  return Response.json({ ok: true });
}, "edit_center");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();

  const r = await Center.updateOne(
    { _id: params.id },
    { $pull: { areas: { _id: params.areaId } } }
  );

  if (!r.matchedCount)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });
  if (!r.modifiedCount)
    return new Response(JSON.stringify({ error: "Area not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "delete_center");
