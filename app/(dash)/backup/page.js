// app/(dash)/backup/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import BackupClient from "./ui/BackupClient";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_roles");
  if (!canManage) redirect("/");
  return <BackupClient />;
}
