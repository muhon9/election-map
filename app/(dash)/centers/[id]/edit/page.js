// app/(dash)/centers/[id]/edit/page.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import CenterForm from "@/components/CenterForm";
import AreasEditor from "@/components/AreasEditor";

export default async function CenterEditPage({ params }) {
  await dbConnect();
  const center = await Center.findById(params.id).lean();
  if (!center) return <div className="p-4">Center not found.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit Center</h1>
      <CenterForm center={JSON.parse(JSON.stringify(center))} />
      <div>
        {/* <h2 className="text-lg font-semibold mb-2">Areas & People</h2> */}
        <AreasEditor
          centerId={String(center._id)}
          initialAreas={JSON.parse(JSON.stringify(center.areas || []))}
        />
      </div>
    </div>
  );
}
