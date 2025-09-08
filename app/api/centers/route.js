import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import Area from "@/models/Area"; // used only for aggregation lookup
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// ---------- GET /api/centers ----------
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "").toLowerCase();

  // Common filter (expanded)
  const q = (searchParams.get("q") || "").trim();
  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: rx },
      { address: rx },
      { notes: rx },
      { "contact.name": rx },
      { "contact.phone": rx },
    ];
  }

  // ---- MAP MODE: return full docs (lean) ----
  if (mode === "map") {
    const docs = await Center.find(filter).sort({ createdAt: -1 }).lean();
    return Response.json(docs);
  }

  // ---- DEFAULT: paginated list with areasCount ----
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
  );
  const sortKey = searchParams.get("sort") || "createdAt";
  const dirStr =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? 1 : -1;

  const sortStage = {};
  if (sortKey === "name") sortStage.name = dirStr;
  else if (sortKey === "totalVoters") sortStage.totalVoters = dirStr;
  else sortStage.createdAt = dirStr;

  const skip = (page - 1) * limit;
  const total = await Center.countDocuments(filter);

  const itemsAgg = await Center.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: "areas",
        localField: "_id",
        foreignField: "center",
        as: "_areas",
      },
    },
    { $addFields: { areasCount: { $size: "$_areas" } } },
    { $project: { _areas: 0 } },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit },
  ]);

  const list = itemsAgg.map((c) => ({
    _id: c._id,
    name: c.name,
    address: c.address || "",
    totalVoters: c.totalVoters ?? 0,
    maleVoters: c.maleVoters ?? 0,
    femaleVoters: c.femaleVoters ?? 0,
    areasCount: c.areasCount ?? 0,
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

// ---------- POST /api/centers ----------
export const POST = withPermApi(async (req) => {
  await dbConnect();

  const body = await req.json();

  // Coerce numbers
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const totalVoters = Number(body.totalVoters ?? 0);
  const maleVoters = Number(body.maleVoters ?? 0);
  const femaleVoters = Number(body.femaleVoters ?? 0);

  // Basic validation
  if (!body?.name || typeof body.name !== "string") {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
    });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(
      JSON.stringify({ error: "lat and lng must be valid numbers" }),
      { status: 400 }
    );
  }
  if (
    [totalVoters, maleVoters, femaleVoters].some(
      (n) => Number.isNaN(n) || n < 0
    )
  ) {
    return new Response(
      JSON.stringify({ error: "voter counts must be non-negative numbers" }),
      { status: 400 }
    );
  }

  // Optional integrity rule (soft): allow but warn on client; we don't hard-block here
  // if (totalVoters < maleVoters + femaleVoters) { ... }

  // Who created it
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;

  const doc = await Center.create({
    name: body.name.trim(),
    address: body.address?.trim() || "",
    lat,
    lng,
    contact: {
      name: body.contactName?.trim() || "",
      phone: body.contactPhone?.trim() || "",
    },
    notes: body.notes?.trim() || "",
    totalVoters,
    maleVoters,
    femaleVoters,
    createdBy: userId,
    updatedBy: userId,
  });

  // Return created document
  return new Response(JSON.stringify(doc), { status: 201 });
}, "add_center");
