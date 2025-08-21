import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import CenterForm from "@/components/CenterForm";

export default async function NewCenterPage() {
  const session = await getServerSession(authOptions);
  const aclOn = process.env.ENABLE_ACL === "1";
  if (aclOn && !session?.user?.permissions?.includes("add_center")) redirect("/centers");

  return (
    <div className="space-y-4">
      <CenterForm />
    </div>
  );
}
