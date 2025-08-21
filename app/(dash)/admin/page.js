import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const perms = session?.user?.permissions || [];
  if (!perms.includes("manage_users") && !perms.includes("manage_roles")) {
    redirect("/"); // no access → back home
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Admin</h1>
      {/* users/roles management UI */}
    </div>
  );
}
