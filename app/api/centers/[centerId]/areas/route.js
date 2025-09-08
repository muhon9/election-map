import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import Area from "@/models/Area";

// GET /api/centers/:centerId/areas?q=&page=1&limit=20&sort=name|createdAt&dir=asc|desc
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") || "createdAt";
  const dir =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  // ensure center exists (optional but helpful)
  const center = await Center.findById(params.centerId).select("_id").lean();
  if (!center)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });

  const filter = { center: params.centerId };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { code: rx }, { notes: rx }];
  }

  const sortMap = {
    name: { name: dir },
    createdAt: { createdAt: dir },
  };
  const sortStage = sortMap[sort] || sortMap.createdAt;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Area.find(filter).sort(sortStage).skip(skip).limit(limit).lean(),
    Area.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "view_centers");

// POST /api/centers/:centerId/areas
// body: { name, code?, totalVoters?, maleVoters?, femaleVoters?, notes? }
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  const center = await Center.findById(params.centerId).select("_id").lean();
  if (!center)
    return new Response(JSON.stringify({ error: "Center not found" }), {
      status: 404,
    });

  const name = (body.name || "").trim();
  if (!name)
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
    });

  const totalVoters = Number(body.totalVoters ?? 0);
  const maleVoters = Number(body.maleVoters ?? 0);
  const femaleVoters = Number(body.femaleVoters ?? 0);
  for (const [k, v] of Object.entries({
    totalVoters,
    maleVoters,
    femaleVoters,
  })) {
    if (Number.isNaN(v) || v < 0)
      return new Response(
        JSON.stringify({ error: `${k} must be a non-negative number` }),
        { status: 400 }
      );
  }

  const doc = await Area.create({
    center: params.centerId,
    name,
    code: (body.code || "").trim(),
    totalVoters,
    maleVoters,
    femaleVoters,
    notes: (body.notes || "").trim(),
  });

  return Response.json(doc, { status: 201 });
}, "edit_center");
