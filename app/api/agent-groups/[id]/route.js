// app/api/agent-groups/[id]/route.js
import dbConnect from "@/lib/db";
import AgentGroup from "@/models/AgentGroup";
import Center from "@/models/Center";
import { oid } from "@/lib/utils";
import { withPermApi } from "@/lib/rbac";

// GET /api/agent-groups/:id
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params?.id);
  if (!id) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const doc = await AgentGroup.findById(id)
    .populate("center", "name address")
    .lean();

  if (!doc) {
    return Response.json({ error: "Agent group not found" }, { status: 404 });
  }

  // Return the document directly (same style as committees/:id)
  return Response.json(doc);
}, "*");

/**
 * PATCH /api/agent-groups/:id
 * body: { name?, notes?, centerId? }  // centerId can be null to clear
 */
export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params?.id);
  if (!id) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const update = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v)
      return Response.json({ error: "Name is required" }, { status: 400 });
    update.name = v;
  }

  if (typeof body.notes === "string") {
    update.notes = body.notes;
  }

  if (typeof body.docLink === "string") {
    update.docLink = body.docLink.trim();
  }

  // Allow centerId to be:
  // - undefined: do nothing
  // - null / "": clear
  // - valid ObjectId: set
  if (body.centerId !== undefined) {
    if (body.centerId === null || body.centerId === "") {
      update.center = null;
    } else {
      const centerId = oid(body.centerId);
      if (!centerId) {
        return Response.json({ error: "Invalid centerId" }, { status: 400 });
      }

      const center = await Center.findById(centerId).select("_id").lean();
      if (!center) {
        return Response.json({ error: "Center not found" }, { status: 404 });
      }

      update.center = centerId;
    }
  }

  const doc = await AgentGroup.findByIdAndUpdate(id, update, {
    new: true,
  })
    .populate("center", "name address")
    .lean();

  if (!doc) {
    return Response.json({ error: "Agent group not found" }, { status: 404 });
  }

  return Response.json({ ok: true, item: doc });
}, "edit_center");

/**
 * DELETE /api/agent-groups/:id
 */
export const DELETE = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = oid(params?.id);
  if (!id) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const res = await AgentGroup.findByIdAndDelete(id).lean();
  if (!res) {
    return Response.json({ error: "Agent group not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}, "delete_center");
