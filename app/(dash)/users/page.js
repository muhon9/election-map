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

  await dbConnect();
  const [users, roles] = await Promise.all([
    User.find({}).populate("role", "name").sort({ createdAt: -1 }).lean(),
    Role.find({}).sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>

      <CreateUserForm roles={roles}  />

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Username</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-t">
                <td className="p-2">{u.username}</td>
                <td className="p-2">{u.role?.name}</td>
                <td className="p-2">{u.email || "-"}</td>
                <td className="p-2">{u.phone || "-"}</td>
                <td className="p-2">
                  <a className="text-blue-600 underline" href={`/users/${u._id}`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
