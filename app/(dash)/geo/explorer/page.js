// app/(dash)/geo/explorer/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ExplorerClient from "./ui/ExplorerClient";

export const dynamic = "force-dynamic";

export default async function GeoExplorerPage() {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_roles");
  if (!canManage) redirect("/");
  return <ExplorerClient />;
}
