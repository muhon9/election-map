// app/(dash)/mosqs/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ListClient from "./ui/ListClient";

export const dynamic = "force-dynamic";

export default async function MosqsPage() {
  const session = await getServerSession(authOptions);
  const canManage =
    session?.user?.permissions?.includes("view_centers") ||
    session?.user?.permissions?.includes("view_centers");
  if (!canManage) redirect("/");

  return <ListClient />;
}
