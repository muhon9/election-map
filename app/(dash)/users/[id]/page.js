import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";

export default async function UserEditPage({ params }) {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_users");
  if (!canManage) redirect("/");

  await dbConnect();
  const [user, roles] = await Promise.all([
    User.findById(params.id).populate("role", "name").lean(),
    Role.find({}).sort({ name: 1 }).lean(),
  ]);
  if (!user) redirect("/users");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit User</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Update role */}
        <form
          action={async (fd) => {
            "use server";
            const roleId = fd.get("roleId");
            await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/users/${user._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roleId }),
            });
          }}
          className="p-3 border rounded bg-white grid gap-2"
        >
          <h2 className="font-medium">Change Role</h2>
          <select name="roleId" className="border px-3 py-2 rounded" defaultValue={user.role?._id?.toString()}>
            {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
          <button className="bg-blue-600 text-white px-3 py-2 rounded w-fit">Update Role</button>
        </form>

        {/* Set temp password */}
        <form
          action={async (fd) => {
            "use server";
            const password = fd.get("password");
            await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/users/${user._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
          }}
          className="p-3 border rounded bg-white grid gap-2"
        >
          <h2 className="font-medium">Set Temporary Password</h2>
          <input name="password" className="border px-3 py-2 rounded" placeholder="New temp password" required />
          <p className="text-xs text-gray-500">User should change password after login.</p>
          <button className="bg-green-600 text-white px-3 py-2 rounded w-fit">Set Password</button>
        </form>
      </div>
    </div>
  );
}
