import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import CenterForm from "@/components/CenterForm";
import AreaList from "@/components/AreaList";
import AreasEditor from "@/components/AreasEditor";

export default async function EditCenterPage({ params }) {
  const session = await getServerSession(authOptions);
  const aclOn = process.env.ENABLE_ACL === "1";
  if (aclOn && !session?.user?.permissions?.includes("edit_center"))
    redirect("/centers");

  await dbConnect();
  const center = await Center.findById(params.id).lean();
  if (!center) redirect("/centers");

  return (
    <div className="space-y-6">
      <CenterForm center={JSON.parse(JSON.stringify(center))} />
      <div className="mt-6">
        <AreasEditor
          centerId={String(center._id)}
          initialAreas={JSON.parse(JSON.stringify(center.areas || []))}
        />
      </div>
    </div>
  );
}
