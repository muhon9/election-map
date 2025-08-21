"use client";
import { useSession, signOut } from "next-auth/react";

export default function Topbar() {
  const { data: session } = useSession();

  return (
    <div className="border-b p-3 flex items-center justify-between">
      <a href="/" className="font-semibold">Election Centers</a>

      {session?.user ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {session.user.username} ({session.user.roleName})
          </span>
          <a href="/change-password" className="underline text-blue-600">Change Password</a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-3 py-1 rounded border hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      ) : (
        <a href="/login" className="underline text-blue-600 text-sm">Login</a>
      )}
    </div>
  );
}
