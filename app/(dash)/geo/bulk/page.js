// app/(dash)/geo/bulk/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import BulkGeoUploadClient from "../ui/BulkGeoUploadClient";

export const dynamic = "force-dynamic";

export default async function BulkGeoPage() {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_roles");
  if (!canManage) redirect("/");
  return <BulkGeoUploadClient />;
}
