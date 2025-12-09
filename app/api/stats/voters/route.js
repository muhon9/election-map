// app/api/stats/voters/route.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import Area from "@/models/Area";
import GeoUnit from "@/models/GeoUnit";
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
 * Filters:
 * - cityId OR city_corporation
 * - upazilaId OR upazila
 * - unionId OR union
 * - wardId OR ward
 *
 * Returns:
 * {
 *   filters: { ... },
 *   centers: <number>,           // total centers in filter
 *   totals: { total, male, female },
 *   topCenters: [ { _id, name, totalVoters, maleVoters, femaleVoters, address } ],
 *   topAreas:   [ { _id, name, totalVoters, centerId, centerName } ],
 *   topWards:   [ { wardId, wardName, centers, totalVoters, maleVoters, femaleVoters } ],
 *   topUnions:  [ { unionId, unionName, centers, totalVoters, maleVoters, femaleVoters } ],
 * }
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
    // Allow EITHER city path OR upazila path (or none)
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

    // ---- Common match filter for Centers ----
    const match = {};
    if (cityId) match.cityId = cityId;
    if (upazilaId) match.upazilaId = upazilaId;
    if (unionId) match.unionId = unionId;
    if (wardId) match.wardId = wardId;

    // =============== MAIN TOTALS ===============
    const [aggTotals] = await Center.aggregate([
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

    const totalCenters = aggTotals?.centers ?? 0;
    const totals = {
      total: aggTotals?.totalVoters ?? 0,
      male: aggTotals?.maleVoters ?? 0,
      female: aggTotals?.femaleVoters ?? 0,
    };

    // =============== TOP 10 CENTERS ===============
    const topCentersAgg = await Center.aggregate([
      { $match: match },
      {
        $addFields: {
          _totalVoters: { $ifNull: ["$totalVoters", 0] },
          _maleVoters: { $ifNull: ["$maleVoters", 0] },
          _femaleVoters: { $ifNull: ["$femaleVoters", 0] },
        },
      },
      { $sort: { _totalVoters: -1, name: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          totalVoters: "$_totalVoters",
          maleVoters: "$_maleVoters",
          femaleVoters: "$_femaleVoters",
        },
      },
    ]);

    const topCenters = topCentersAgg || [];

    // =============== TOP 10 AREAS (inside filtered centers) ===============
    // First, find all centers in filter to get IDs for Area match
    const centerIdsForAreas = await Center.find(match)
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id));

    let topAreas = [];
    if (centerIdsForAreas.length > 0) {
      const topAreasAgg = await Area.aggregate([
        { $match: { center: { $in: centerIdsForAreas } } },
        {
          $addFields: {
            _totalVoters: { $ifNull: ["$totalVoters", 0] },
          },
        },
        { $sort: { _totalVoters: -1, name: 1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "centers",
            localField: "center",
            foreignField: "_id",
            as: "_center",
          },
        },
        { $unwind: { path: "$_center", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: 1,
            totalVoters: "$_totalVoters",
            centerId: "$center",
            centerName: "$_center.name",
          },
        },
      ]);
      topAreas = topAreasAgg || [];
    }

    // =============== TOP 10 WARDS ===============
    // Group centers by wardId and sum voters
    const topWardsAgg = await Center.aggregate([
      { $match: match },
      { $match: { wardId: { $ne: null } } },
      {
        $group: {
          _id: "$wardId",
          centers: { $sum: 1 },
          totalVoters: { $sum: { $ifNull: ["$totalVoters", 0] } },
          maleVoters: { $sum: { $ifNull: ["$maleVoters", 0] } },
          femaleVoters: { $sum: { $ifNull: ["$femaleVoters", 0] } },
        },
      },
      { $sort: { totalVoters: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "geounits",
          localField: "_id",
          foreignField: "_id",
          as: "ward",
        },
      },
      { $unwind: { path: "$ward", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          wardId: "$_id",
          wardName: "$ward.name",
          centers: 1,
          totalVoters: 1,
          maleVoters: 1,
          femaleVoters: 1,
        },
      },
    ]);

    const topWards = topWardsAgg || [];

    // =============== TOP 10 UNIONS ===============
    const topUnionsAgg = await Center.aggregate([
      { $match: match },
      { $match: { unionId: { $ne: null } } },
      {
        $group: {
          _id: "$unionId",
          centers: { $sum: 1 },
          totalVoters: { $sum: { $ifNull: ["$totalVoters", 0] } },
          maleVoters: { $sum: { $ifNull: ["$maleVoters", 0] } },
          femaleVoters: { $sum: { $ifNull: ["$femaleVoters", 0] } },
        },
      },
      { $sort: { totalVoters: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "geounits",
          localField: "_id",
          foreignField: "_id",
          as: "union",
        },
      },
      { $unwind: { path: "$union", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          unionId: "$_id",
          unionName: "$union.name",
          centers: 1,
          totalVoters: 1,
          maleVoters: 1,
          femaleVoters: 1,
        },
      },
    ]);

    const topUnions = topUnionsAgg || [];

    const result = {
      filters: {
        cityId: cityId?.toString() || null,
        upazilaId: upazilaId?.toString() || null,
        unionId: unionId?.toString() || null,
        wardId: wardId?.toString() || null,
      },
      centers: totalCenters,
      totals,
      topCenters,
      topAreas,
      topWards,
      topUnions,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err?.message || "Failed to compute voter stats",
      }),
      {
        status: 400,
      }
    );
  }
}, "*");
