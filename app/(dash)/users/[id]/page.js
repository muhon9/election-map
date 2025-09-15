// app/dash/users/[id]/page.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";

export default async function UserEditPage({ params }) {
  const session = await getServerSession(authOptions);
  const canManage = session?.user?.permissions?.includes("manage_users");
  if (!canManage) redirect("/");

  const actorId = session?.user?.id;
  const actorLevel =
    typeof session?.user?.roleLevel === "number" ? session.user.roleLevel : 100;

  await dbConnect();

  // Load target with role name+level
  const user = await User.findById(params.id)
    .populate("role", "name level")
    .lean();

  if (!user) redirect("/users");

  const targetLevel =
    typeof user.role?.level === "number" ? user.role.level : 100;

  // Hierarchy guard: you cannot manage a user more powerful than you
  if (targetLevel < actorLevel) {
    redirect("/users");
  }

  // Roles you are allowed to assign (level >= your level)
  const roles = await Role.find({ level: { $gte: actorLevel } })
    .sort({ level: 1, name: 1 })
    .lean();

  const isSelf = actorId === user._id.toString();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit User</h1>
      <div className="text-sm text-gray-600">
        <div>
          <span className="font-medium">Username:</span> {user.username}
        </div>
        <div>
          <span className="font-medium">Current role:</span>{" "}
          {user.role?.name || "-"}{" "}
          <span className="text-gray-400">(level {targetLevel})</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Update role (disabled if editing self) */}
        <form
          action={async (fd) => {
            "use server";
            const roleId = fd.get("roleId");

            // Build absolute same-origin URL for Server Action fetch
            const h = headers();
            const proto = h.get("x-forwarded-proto") || "http";
            const host =
              h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
            const base = `${proto}://${host}`;

            const res = await fetch(`${base}/api/users/${user._id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                // forward auth cookies explicitly
                cookie: cookies().toString(),
              },
              credentials: "include",
              cache: "no-store",
              body: JSON.stringify({ roleId }),
            });

            if (!res.ok) {
              let msg = "Failed to update role";
              try {
                const data = await res.json();
                if (data?.error) msg = data.error;
              } catch {}
              throw new Error(msg);
            }

            // Refresh this page and users list
            revalidatePath(`/users/${user._id}`);
            revalidatePath(`/users`);
          }}
          className="p-3 border rounded bg-white grid gap-2"
        >
          <h2 className="font-medium">Change Role</h2>
          <select
            name="roleId"
            className="border px-3 py-2 rounded"
            defaultValue={user.role?._id?.toString()}
            disabled={isSelf} // prevent self role change
          >
            {roles.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name} (lvl {typeof r.level === "number" ? r.level : 100})
              </option>
            ))}
          </select>
          <button
            className={`px-3 py-2 rounded w-fit ${
              isSelf
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 text-white"
            }`}
            disabled={isSelf}
          >
            {isSelf ? "You can't change your own role" : "Update Role"}
          </button>
        </form>

        {/* Set temp password */}
        <form
          action={async (fd) => {
            "use server";
            const password = fd.get("password");

            const h = headers();
            const proto = h.get("x-forwarded-proto") || "http";
            const host =
              h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
            const base = `${proto}://${host}`;

            const res = await fetch(`${base}/api/users/${user._id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                cookie: cookies().toString(),
              },
              credentials: "include",
              cache: "no-store",
              body: JSON.stringify({ password }),
            });

            if (!res.ok) {
              let msg = "Failed to set password";
              try {
                const data = await res.json();
                if (data?.error) msg = data.error;
              } catch {}
              throw new Error(msg);
            }

            revalidatePath(`/users/${user._id}`);
            revalidatePath(`/users`);
          }}
          className="p-3 border rounded bg-white grid gap-2"
        >
          <h2 className="font-medium">Set Temporary Password</h2>
          <input
            name="password"
            className="border px-3 py-2 rounded"
            placeholder="New temp password"
            required
            minLength={8}
          />
          <p className="text-xs text-gray-500">
            User should change password after login.
          </p>
          <button className="bg-green-600 text-white px-3 py-2 rounded w-fit">
            Set Password
          </button>
        </form>
      </div>
    </div>
  );
}
