import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";

// GET /api/centers
// - mode=map : returns FULL center docs (all fields), filtered by optional q
// - default  : paginated list { items, total, page, pageSize, pages } with q/sort/dir
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "").toLowerCase();

  // ---------- MAP MODE: full documents ----------
  if (mode === "map") {
    const q = (searchParams.get("q") || "").trim();

    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: rx },
        { address: rx },
        { "contact.name": rx },
        { "contact.phone": rx },
      ];
    }

    // Return ALL fields of each center (lean for perf)
    // If you end up with too much data, consider adding ?limit or excluding heavy subdocs.
    const docs = await Center.find(filter).sort({ createdAt: -1 }).lean();
    return Response.json(docs);
  }

  // ---------- DEFAULT PAGINATED LIST ----------
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
  );
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") || "createdAt";
  const dir =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: rx },
      { address: rx },
      { "contact.name": rx },
      { "contact.phone": rx },
    ];
  }

  const sortMap = {
    name: { name: dir },
    totalVoters: { totalVoters: dir },
    createdAt: { createdAt: dir },
  };
  const sortStage = sortMap[sort] || sortMap.createdAt;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Center.find(filter).sort(sortStage).skip(skip).limit(limit).lean(),
    Center.countDocuments(filter),
  ]);

  const list = items.map((c) => ({
    _id: c._id,
    name: c.name,
    address: c.address || "",
    totalVoters: c.totalVoters ?? 0,
    maleVoters: c.maleVoters ?? 0,
    femaleVoters: c.femaleVoters ?? 0,
    areasCount: Array.isArray(c.areas) ? c.areas.length : 0,
    createdAt: c.createdAt,
    lat: c.lat,
    lng: c.lng,
  }));

  return Response.json({
    items: list,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "view_centers");
