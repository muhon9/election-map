// app/(dash)/centers/[id]/edit/page.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import AreaList from "@/components/AreaList";
import CenterForm from "@/components/CenterForm";
import PeopleEditor from "@/components/PeopleEditor"; // optional if you link into each Area

export default async function CenterEditPage({ params }) {
  await dbConnect();
  const center = await Center.findById(params.id).lean();
  if (!center) return <div className="p-4">Center not found.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit Center – {center.name}</h1>
      <CenterForm center={JSON.parse(JSON.stringify(center))} />
      <section>
        <h2 className="text-lg font-semibold mb-2">Areas</h2>
        <AreaList centerId={String(center._id)} />
      </section>
    </div>
  );
}
