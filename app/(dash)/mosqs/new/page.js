// app/(dash)/mosqs/new/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import MosqForm from "../ui/MosqForm";

export const dynamic = "force-dynamic";

export default async function NewMosqPage() {
  const session = await getServerSession(authOptions);
  const canManage =
    session?.user?.permissions?.includes("view_centers") ||
    session?.user?.permissions?.includes("view_centers");
  if (!canManage) redirect("/");

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add Mosq</h1>
        <Link
          href="/mosqs/bulk"
          className="bg-gray-800 text-white px-3 py-2 rounded"
        >
          Upload Bulk Mosqs
        </Link>
      </div>
      <MosqForm mode="create" />
    </div>
  );
}
