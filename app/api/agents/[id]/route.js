import dbConnect from "@/lib/db";
import Agent from "@/models/Agent";
import { withPermApi } from "@/lib/rbac";
import { oid } from "@/lib/utils";

// GET /api/agents/:id
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params.id);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const item = await Agent.findById(id)
    .populate({
      path: "agentGroupId",
      select: "name center",
      populate: { path: "center", select: "name address" },
    })
    .lean();

  if (!item) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  return Response.json({ item });
}, "*");

// PATCH /api/agents/:id
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params.id);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const update = {};

  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.areaName === "string") update.areaName = body.areaName.trim();
  if (typeof body.mobile === "string") update.mobile = body.mobile.trim();
  if (typeof body.nid === "string") update.nid = body.nid.trim();
  if (body.order !== undefined) update.order = Number(body.order || 0);
  if (typeof body.active === "boolean") update.active = body.active;

  // ✅ Image support (schema: image: { url, thumbnailUrl })
  // Preferred payload: { image: { url, thumbnailUrl } }
  if (body.image && typeof body.image === "object") {
    update.image = {
      url: typeof body.image.url === "string" ? body.image.url : "",
      thumbnailUrl:
        typeof body.image.thumbnailUrl === "string"
          ? body.image.thumbnailUrl
          : "",
    };
  }

  // Backward compat: allow { imageUrl: "..." } or { image: "..." }
  if (typeof body.imageUrl === "string") {
    update.image = {
      url: body.imageUrl,
      thumbnailUrl: "",
    };
  } else if (typeof body.image === "string") {
    update.image = {
      url: body.image,
      thumbnailUrl: "",
    };
  }

  const item = await Agent.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!item)
    return Response.json({ error: "Agent not found" }, { status: 404 });

  return Response.json({ ok: true, item });
}, "edit_center");

// DELETE /api/agents/:id
export const DELETE = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params.id);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const item = await Agent.findByIdAndDelete(id).lean();

  if (!item)
    return Response.json({ error: "Agent not found" }, { status: 404 });
  return Response.json({ ok: true });
}, "delete_center");
