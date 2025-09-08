import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Area from "@/models/Area";
import Person, { PERSON_CATEGORIES } from "@/models/Person";

// GET /api/areas/:areaId/people?category=&q=&page=1&limit=20&sort=importance|name|createdAt&dir=desc|asc
// Optional: committeeName=... (to filter committee group)
export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const q = (searchParams.get("q") || "").trim();
  const cat = (searchParams.get("category") || "").trim().toUpperCase();
  const sort = searchParams.get("sort") || "importance";
  const dir =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;
  const committeeName = (searchParams.get("committeeName") || "").trim();

  // ensure area exists
  const area = await Area.findById(params.areaId).select("_id").lean();
  if (!area)
    return new Response(JSON.stringify({ error: "Area not found" }), {
      status: 404,
    });

  const filter = { area: params.areaId };
  if (cat) filter.category = cat;
  if (committeeName) filter.committeeName = committeeName;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: rx },
      { designation: rx },
      { phone: rx },
      { notes: rx },
    ];
  }

  const sortMap = {
    importance: { importance: dir, name: 1 },
    name: { name: dir },
    createdAt: { createdAt: dir },
    order: { order: dir, name: 1 }, // useful for COMMITTEE
  };
  const sortStage = sortMap[sort] || sortMap.importance;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Person.find(filter).sort(sortStage).skip(skip).limit(limit).lean(),
    Person.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "view_centers");

// POST /api/areas/:areaId/people
// body: { category, name, phone?, designation?, importance?, committeeName?, position?, order?, notes?, tags?, whatsapp?, email? }
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();
  const b = await req.json();

  // ensure area exists
  const area = await Area.findById(params.areaId).select("_id").lean();
  if (!area)
    return new Response(JSON.stringify({ error: "Area not found" }), {
      status: 404,
    });

  const name = (b.name || "").trim();
  if (!name)
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
    });

  const category = String(b.category || "").toUpperCase();
  if (!PERSON_CATEGORIES.includes(category)) {
    return new Response(
      JSON.stringify({
        error: `category must be one of ${PERSON_CATEGORIES.join(", ")}`,
      }),
      { status: 400 }
    );
  }

  // Coerce numbers
  const importance = Number(b.importance ?? 0);
  const order = Number(b.order ?? 0);
  if (Number.isNaN(importance) || importance < 0) {
    return new Response(
      JSON.stringify({ error: "importance must be a non-negative number" }),
      { status: 400 }
    );
  }
  if (Number.isNaN(order) || order < 0) {
    return new Response(
      JSON.stringify({ error: "order must be a non-negative number" }),
      { status: 400 }
    );
  }

  // (Optional) require phone for COMMUNICATE if you want:
  // if (category === "COMMUNICATE" && !b.phone) { ... }

  const doc = await Person.create({
    area: params.areaId,
    center: b.center || null, // usually null for area-scoped; allowed if you want dual-scope
    category,
    name,
    phone: (b.phone || "").trim(),
    whatsapp: (b.whatsapp || "").trim(),
    email: (b.email || "").trim(),
    designation: (b.designation || "").trim(),
    importance,
    committeeName: (b.committeeName || "").trim(),
    position: (b.position || "").trim(),
    order,
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    notes: (b.notes || "").trim(),
  });

  return Response.json(doc, { status: 201 });
}, "edit_center");
