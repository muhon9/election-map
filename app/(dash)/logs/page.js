// app/(dash)/logs/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LogsClient from "./ui/LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await getServerSession(authOptions);
  const canView = session?.user?.permissions?.includes("manage_roles");
  if (!canView) redirect("/");

  return <LogsClient />;
}
