// app/api/public-stats/areas-geo/route.js
import dbConnect from "@/lib/db";
import Area from "@/models/Area";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    // Expecting Area schema to have `geo` as GeoJSON { type: 'Polygon'|'MultiPolygon', coordinates: [...] }
    const areas = await Area.find(
      { geo: { $exists: true, $ne: null } },
      { name: 1, geo: 1 }
    ).lean();

    const fc = {
      type: "FeatureCollection",
      features: (areas || []).map((a) => ({
        type: "Feature",
        id: String(a._id),
        properties: { id: String(a._id), name: a.name },
        geometry: a.geo,
      })),
    };

    return Response.json(fc);
  } catch (e) {
    console.error("areas-geo error", e);
    // Return an empty collection instead of 500 so the page still renders
    return Response.json({ type: "FeatureCollection", features: [] });
  }
}
