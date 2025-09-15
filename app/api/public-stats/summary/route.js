// app/api/public-stats/summary/route.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import Area from "@/models/Area";
import Person from "@/models/Person";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();

    const [centers, areas, people, votesAgg] = await Promise.all([
      Center.countDocuments({}),
      Area.countDocuments({}),
      Person.countDocuments({}),
      // Try to compute votes (works even if fields don't exist)
      Person.aggregate([
        {
          $group: {
            _id: null,
            votes: {
              $sum: {
                $add: [
                  { $ifNull: ["$votes", 0] }, // numeric field ‘votes’ (if you have it)
                  { $ifNull: ["$voteCount", 0] }, // or ‘voteCount’
                  { $cond: [{ $eq: ["$voted", true] }, 1, 0] }, // or boolean ‘voted’
                ],
              },
            },
          },
        },
      ]),
    ]);

    const votes = votesAgg?.[0]?.votes ?? 0;

    return Response.json({ counts: { centers, areas, people, votes } });
  } catch (e) {
    console.error("summary error", e);
    return new Response(JSON.stringify({ error: "Failed to load summary" }), {
      status: 500,
    });
  }
}
