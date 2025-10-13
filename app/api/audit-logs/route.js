// app/api/audit-logs/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import AuditLog from "@/models/AuditLog";

export const GET = withPermApi(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const action = (searchParams.get("action") || "").trim(); // e.g. "create,update"
  const entityType = (searchParams.get("entityType") || "").trim(); // e.g. "user"
  const actorId = (searchParams.get("actorId") || "").trim();
  const from = searchParams.get("from"); // ISO date
  const to = searchParams.get("to"); // ISO date

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  const filter = {};

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ summary: rx }, { actorUsername: rx }];
  }
  if (action) {
    const list = action
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) filter.action = { $in: list };
  }
  if (entityType) filter.entityType = entityType;
  if (actorId) filter.actorId = actorId;

  if (from || to) {
    filter.ts = {};
    if (from) filter.ts.$gte = new Date(from);
    if (to) filter.ts.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ ts: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "manage_roles");
