// app/api/stats/voters/route.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import { withPermApi } from "@/lib/rbac";
import mongoose from "mongoose";

const { Types } = mongoose;

function pickId(searchParams, keys) {
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") return v;
  }
  return null;
}

function toObjIdOrNull(v, name) {
  if (v == null || v === "") return null;
  if (!Types.ObjectId.isValid(v)) {
    throw new Error(`${name} is not a valid ObjectId`);
  }
  return new Types.ObjectId(v);
}

/**
 * GET /api/stats/voters
 *
 * Accepted query params:
 * - cityId OR city_corporation
 * - upazilaId OR upazila
 * - unionId OR union
 * - wardId OR ward
 *
 * Examples:
 * - /api/stats/voters                          → all centers
 * - /api/stats/voters?cityId=...               → a city corporation (optionally add wardId)
 * - /api/stats/voters?city_corporation=...&ward=...  → city ward
 * - /api/stats/voters?upazilaId=...           → an upazila
 * - /api/stats/voters?upazila=...&union=...   → a union in that upazila
 * - /api/stats/voters?upazila=...&union=...&ward=... → a rural ward
 */
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);

  // Accept multiple naming styles
  const cityIdStr = pickId(searchParams, ["cityId", "city_corporation"]);
  const upazilaIdStr = pickId(searchParams, ["upazilaId", "upazila"]);
  const unionIdStr = pickId(searchParams, ["unionId", "union"]);
  const wardIdStr = pickId(searchParams, ["wardId", "ward"]);

  try {
    // Validate exclusivity of top-level: allow EITHER city path OR upazila path (or none)
    if (cityIdStr && upazilaIdStr) {
      return new Response(
        JSON.stringify({
          error:
            "Provide either cityId (city_corporation) OR upazilaId, not both",
        }),
        { status: 400 }
      );
    }

    const cityId = toObjIdOrNull(cityIdStr, "cityId");
    const upazilaId = toObjIdOrNull(upazilaIdStr, "upazilaId");
    const unionId = toObjIdOrNull(unionIdStr, "unionId");
    const wardId = toObjIdOrNull(wardIdStr, "wardId");

    // Build match filter
    const match = {};
    if (cityId) match.cityId = cityId;
    if (upazilaId) match.upazilaId = upazilaId;
    if (unionId) match.unionId = unionId;
    if (wardId) match.wardId = wardId;

    // Aggregate totals
    const [agg] = await Center.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          centers: { $sum: 1 },
          totalVoters: { $sum: { $ifNull: ["$totalVoters", 0] } },
          maleVoters: { $sum: { $ifNull: ["$maleVoters", 0] } },
          femaleVoters: { $sum: { $ifNull: ["$femaleVoters", 0] } },
        },
      },
    ]);

    const result = {
      filters: {
        cityId: cityId?.toString() || null,
        upazilaId: upazilaId?.toString() || null,
        unionId: unionId?.toString() || null,
        wardId: wardId?.toString() || null,
      },
      centers: agg?.centers ?? 0,
      totals: {
        total: agg?.totalVoters ?? 0,
        male: agg?.maleVoters ?? 0,
        female: agg?.femaleVoters ?? 0,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err?.message || "Failed to compute voter totals",
      }),
      {
        status: 400,
      }
    );
  }
}, "view_centers");
