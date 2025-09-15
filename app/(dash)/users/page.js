// app/(dash)/users/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import CreateUserForm from "@/components/CreateUserForm";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const canManageUsers = session?.user?.permissions?.includes("manage_users");
  if (!canManageUsers) redirect("/");

  const actorLevel =
    typeof session?.user?.roleLevel === "number" ? session.user.roleLevel : 100;

  await dbConnect();

  // 1) Roles you are allowed to assign (level >= your level)
  const roles = await Role.find({ level: { $gte: actorLevel } })
    .sort({ level: 1, name: 1 })
    .lean();

  // 2) Users you are allowed to manage/see (their current role level >= your level)
  const allUsers = await User.find({})
    .populate("role", "name level")
    .sort({ createdAt: -1 })
    .lean();

  const users = allUsers.filter((u) => {
    const lvl = typeof u.role?.level === "number" ? u.role.level : 100;
    return lvl >= actorLevel;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>

      {/* Create form now receives only assignable roles (respecting hierarchy) */}
      <CreateUserForm roles={roles} />

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Username</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Level</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="p-2">{u.username}</td>
                <td className="p-2">{u.role?.name || "-"}</td>
                <td className="p-2">
                  {typeof u.role?.level === "number" ? u.role.level : 100}
                </td>
                <td className="p-2">{u.email || "-"}</td>
                <td className="p-2">{u.phone || "-"}</td>
                <td className="p-2">
                  <a
                    className="text-blue-600 underline"
                    href={`/users/${u._id}`}
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No users you can manage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
