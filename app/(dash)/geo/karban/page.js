// app/(dash)/geo/kanban/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import KanbanGeoClient from "./ui/KanbanGeoClient";

export const dynamic = "force-dynamic";

export default async function KanbanGeoPage() {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_roles");
  if (!canManage) redirect("/");
  return <KanbanGeoClient />;
}
