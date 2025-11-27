// app/api/mosqs/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Mosq from "@/models/Mosq";
import Center from "@/models/Center";
import Area from "@/models/Area";
import { validateGeoChain } from "@/lib/geo-validate";

// GET /api/mosqs?q=&centerId=&areaId=&page=&limit=
export const GET = withPermApi(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const cityId = (searchParams.get("cityId") || "").trim();
  const upazilaId = (searchParams.get("upazilaId") || "").trim();
  const unionId = (searchParams.get("unionId") || "").trim();
  const wardId = (searchParams.get("wardId") || "").trim();

  const centerId = (searchParams.get("centerId") || "").trim();
  const areaId = (searchParams.get("areaId") || "").trim();

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: rx },
      { address: rx },
      { upazila: rx },
      { ward: rx },
      { contact: rx },
    ];
  }
  if (centerId) filter.center = centerId;
  if (areaId) filter.area = areaId;
  if (cityId) filter.cityId = cityId;
  if (upazilaId) filter.upazilaId = upazilaId;
  if (unionId) filter.unionId = unionId;
  if (wardId) filter.wardId = wardId;

  // Validate centerId and areaId

  const [items, total] = await Promise.all([
    Mosq.find(filter)
      .populate("center", "name")
      .populate("area", "name")
      .populate("cityId", "name")
      .populate("upazilaId", "name")
      .populate("unionId", "name")
      .populate("wardId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Mosq.countDocuments(filter),
  ]);

  return Response.json({
    items,
    total,
    page,
    pageSize: limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}, "*"); // or "manage_mosqs"

// POST /api/mosqs
// body: { name, address?, upazila?, ward?, contact?, centerId?, areaId?, location?: {lat, lng} }
// app/api/mosqs/route.js (POST)

export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();

  const payload = {
    name: String(body?.name || "").trim(),
    address: String(body?.address || "").trim(),
    cityId: body?.cityId || null,
    upazilaId: body?.upazilaId || null,
    unionId: body?.unionId || null,
    wardId: body?.wardId || null,
    contact: String(body?.contact || "").trim(),
    location: {
      lat: Number(body?.location?.lat) || 0,
      lng: Number(body?.location?.lng) || 0,
    },
  };
  if (!payload.name) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
    });
  }

  // Validate chain
  if (
    payload.cityId ||
    payload.upazilaId ||
    payload.unionId ||
    payload.wardId
  ) {
    try {
      await validateGeoChain({
        cityId: payload.cityId,
        upazilaId: payload.upazilaId,
        unionId: payload.unionId,
        wardId: payload.wardId,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
      });
    }
  }

  const doc = await Mosq.create(payload);
  return Response.json(doc, { status: 201 });
}, "view_centers"); // or a different perm if needed
