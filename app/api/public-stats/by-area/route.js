// app/api/public-stats/by-area/route.js
import dbConnect from "@/lib/db";
import Area from "@/models/Area";
import Center from "@/models/Center";
import Person from "@/models/Person";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();

    // Centers per area
    const centersAgg = await Center.aggregate([
      { $group: { _id: "$area", centers: { $sum: 1 } } },
    ]);

    // People (and votes) per area, prefer Person.area; else derive via Person.center -> Center.area
    const peopleAgg = await Person.aggregate([
      {
        $lookup: {
          from: "centers",
          localField: "center",
          foreignField: "_id",
          as: "c",
        },
      },
      {
        $addFields: {
          _area: {
            $ifNull: ["$area", { $arrayElemAt: ["$c.area", 0] }],
          },
        },
      },
      {
        $group: {
          _id: "$_area",
          people: { $sum: 1 },
          votes: {
            $sum: {
              $add: [
                { $ifNull: ["$votes", 0] },
                { $ifNull: ["$voteCount", 0] },
                { $cond: [{ $eq: ["$voted", true] }, 1, 0] },
              ],
            },
          },
        },
      },
    ]);

    // Merge by areaId
    const map = new Map(); // areaId -> { centers, people, votes }
    for (const c of centersAgg) {
      const k = String(c._id || "");
      if (!k) continue;
      map.set(k, { areaId: k, centers: c.centers || 0, people: 0, votes: 0 });
    }
    for (const p of peopleAgg) {
      const k = String(p._id || "");
      if (!k) continue;
      const prev = map.get(k) || { areaId: k, centers: 0, people: 0, votes: 0 };
      map.set(k, { ...prev, people: p.people || 0, votes: p.votes || 0 });
    }

    // Attach area names
    const ids = Array.from(map.keys())
      .filter(Boolean)
      .map((s) => new mongoose.Types.ObjectId(s));
    const areas = ids.length
      ? await Area.find({ _id: { $in: ids } }, { name: 1 }).lean()
      : [];
    const nameMap = new Map(areas.map((a) => [String(a._id), a.name]));

    const items = Array.from(map.values())
      .map((r) => ({
        ...r,
        areaName: nameMap.get(r.areaId) || r.areaId,
      }))
      .sort((a, b) => (b.votes || 0) - (a.votes || 0)); // highest votes first

    return Response.json({ items });
  } catch (e) {
    console.error("by-area error", e);
    return new Response(
      JSON.stringify({ error: "Failed to load area stats" }),
      { status: 500 }
    );
  }
}
