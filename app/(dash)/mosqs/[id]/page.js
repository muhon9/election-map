// app/(dash)/mosqs/[id]/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import MosqForm from "../ui/MosqForm";

export const dynamic = "force-dynamic";

export default async function EditMosqPage({ params }) {
  const session = await getServerSession(authOptions);
  const canManage =
    session?.user?.permissions?.includes("view_centers") ||
    session?.user?.permissions?.includes("view_centers");
  if (!canManage) redirect("/");

  return <MosqForm mode="edit" id={params.id} />;
}
