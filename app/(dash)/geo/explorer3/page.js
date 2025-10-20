// app/(dash)/geo/explorer3/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Explorer3Client from "./ui/Explorer3Client";

export const dynamic = "force-dynamic";

export default async function GeoExplorer3Page() {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_roles");
  if (!canManage) redirect("/");
  return <Explorer3Client />;
}
