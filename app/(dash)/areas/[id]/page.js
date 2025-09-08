// app/(dash)/areas/[id]/page.js
import dbConnect from "@/lib/db";
import Area from "@/models/Area";
import PeopleEditor from "@/components/PeopleEditor";

export default async function AreaPage({ params }) {
  await dbConnect();
  const area = await Area.findById(params.id).populate("center", "name").lean();
  if (!area) return <div className="p-4">Area not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {area.name}
            {area.code ? ` (${area.code})` : ""}
          </h1>
          <div className="text-sm text-gray-600">
            Center:{" "}
            <a
              className="text-blue-600 underline"
              href={`/centers/${area.center?._id}`}
            >
              {area.center?.name || "—"}
            </a>
          </div>
        </div>
        <a
          className="px-3 py-2 border rounded hover:bg-gray-50"
          href={`/centers/${area.center?._id}`}
        >
          Back to Center
        </a>
      </div>

      <PeopleEditor areaId={String(area._id)} />
    </div>
  );
}
