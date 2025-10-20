// app/(dash)/mosqs/bulk/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import BulkUploadClient from "../ui/BulkUploadClient";

export const dynamic = "force-dynamic";

export default async function BulkMosqPage() {
  const session = await getServerSession(authOptions);
  const canManage =
    session?.user?.permissions?.includes("view_centers") ||
    session?.user?.permissions?.includes("view_centers");
  if (!canManage) redirect("/");

  return <BulkUploadClient />;
}
