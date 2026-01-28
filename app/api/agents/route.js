// app/api/agents/route.js
import dbConnect from "@/lib/db";
import Agent from "@/models/Agent";
import AgentGroup from "@/models/AgentGroup";
import { withPermApi } from "@/lib/rbac";
import { oid } from "@/lib/utils";

function pickImage(body) {
  // Accept multiple possible shapes from frontend/uploader
  // 1) imageUrl / photoUrl (string)
  const url =
    (typeof body.imageUrl === "string" && body.imageUrl.trim()) ||
    (typeof body.photoUrl === "string" && body.photoUrl.trim()) ||
    (typeof body.image === "string" && body.image.trim()) ||
    (typeof body.image?.url === "string" && body.image.url.trim()) ||
    "";

  if (!url) return undefined;

  // If your schema stores string => return url
  // If your schema stores object => return { url, ... }
  // We'll return object if extra fields exist, otherwise a string is also fine
  if (body.image && typeof body.image === "object") {
    return {
      url,
      filename: body.image.filename || "",
      mime: body.image.mime || "",
      size: Number(body.image.size || 0),
      thumbnailUrl: body.image.thumbnailUrl || "",
    };
  }

  return { url };
}

export const GET = withPermApi(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);

  // accept both: ?agentGroupId= and ?groupId=
  const agentGroupId = oid(
    searchParams.get("agentGroupId") || searchParams.get("groupId"),
  );

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit") || 50)),
  );

  const match = {};
  if (agentGroupId) match.agentGroupId = agentGroupId;

  const [items, total] = await Promise.all([
    Agent.find(match)
      .sort({ order: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Agent.countDocuments(match),
  ]);

  return Response.json({ page, limit, total, items });
}, "*");

export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json().catch(() => ({}));

  // accept both: groupId and agentGroupId
  const groupId = oid(body.groupId || body.agentGroupId);
  if (!groupId) {
    return Response.json({ error: "Invalid agentGroupId" }, { status: 400 });
  }

  const group = await AgentGroup.findById(groupId).select("_id").lean();
  if (!group) {
    return Response.json({ error: "Agent group not found" }, { status: 404 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Agent name is required" }, { status: 400 });
  }

  // accept both areaName and area (because UI often uses "area")
  const areaName =
    (typeof body.areaName === "string" && body.areaName.trim()) ||
    (typeof body.area === "string" && body.area.trim()) ||
    "";

  const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
  const nid = typeof body.nid === "string" ? body.nid.trim() : "";
  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;

  const image = pickImage(body); // ✅ FIX: now captures imageUrl/photoUrl/image
  console.log("body", body.imageUrl);
  console.log(image);
  const agent = await Agent.create({
    agentGroupId: groupId,
    name,
    areaName,
    mobile,
    nid,
    order,
    ...(image ? { image } : {}), // only set if present
  });

  // keep response shape stable; returning agent directly is fine
  return Response.json({ ok: true, item: agent });
}, "edit_center");
