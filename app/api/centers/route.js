import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Center from "@/models/Center";
import Area from "@/models/Area"; // used only for aggregation lookup
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { validateGeoChain } from "@/lib/geo-validate";
import { Types } from "mongoose";

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

// ---------- GET /api/centers ----------
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "").toLowerCase();

  // -------- Common filter (with area-name search) --------
  const q = (searchParams.get("q") || "").trim();
  const filter = {};

  // Geo filters
  const cityId = oid(
    searchParams.get("cityId") || searchParams.get("city_corporation")
  );
  const upazilaId = oid(
    searchParams.get("upazilaId") || searchParams.get("upazila")
  );
  const unionId = oid(searchParams.get("unionId") || searchParams.get("union"));
  const wardId = oid(searchParams.get("wardId") || searchParams.get("ward"));

  if (cityId) filter.cityId = cityId;
  if (upazilaId) filter.upazilaId = upazilaId;
  if (unionId) filter.unionId = unionId;
  if (wardId) filter.wardId = wardId;

  // Voter range filter: vr=min-max (e.g. "0-500", "500-1500", "3000-999999")
  const vr = (searchParams.get("vr") || "").trim();
  if (vr) {
    const parts = vr.split("-");
    if (parts.length === 2) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      const voterFilter = {};

      if (!Number.isNaN(min)) voterFilter.$gte = min;
      if (!Number.isNaN(max)) voterFilter.$lte = max;

      if (Object.keys(voterFilter).length > 0) {
        filter.totalVoters = voterFilter;
      }
    }
  }

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // Find centers whose areas (by name) match q
    const centerIdsFromAreas = await Area.find({ name: rx }).distinct("center");

    filter.$or = [
      { name: rx },
      { address: rx },
      { notes: rx },
      { "contact.name": rx },
      { "contact.phone": rx },
      ...(centerIdsFromAreas.length
        ? [{ _id: { $in: centerIdsFromAreas } }]
        : []),
    ];
  }

  // ---- MAP MODE: return full docs ----
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
  else sortStage.name = dirStr;

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
}, "*");

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

  // Normalize incoming geo ids ("" -> null)
  const norm = (v) => (v === "" || v === undefined ? null : v);

  const geo = {
    cityId: norm(body.cityId) ?? null,
    upazilaId: norm(body.upazilaId) ?? null,
    unionId: norm(body.unionId) ?? null,
    wardId: norm(body.wardId) ?? null,
  };

  // Validate geo chain (throws if invalid)
  try {
    await validateGeoChain(geo);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }

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
    // store refs
    cityId: geo.cityId,
    upazilaId: geo.upazilaId,
    unionId: geo.unionId,
    wardId: geo.wardId,
    createdBy: userId,
    updatedBy: userId,
  });

  return new Response(JSON.stringify(doc), { status: 201 });
}, "add_center");
