"use client";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function UserBadge() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-10 w-32 animate-pulse bg-gray-200 rounded" />;
  }
  if (!session?.user) return null;

  const username = session.user.username || "User";
  const role = session.user.roleName || session.user.role || "—";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md border hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Avatar circle */}
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-900 text-white text-xs">
          {initials}
        </span>

        {/* Username + role always visible */}
        <div className="text-left">
          <div className="text-sm font-medium leading-tight">{username}</div>
          <div className="text-xs text-gray-500 leading-tight">{role}</div>
        </div>

        <span className="ml-1 text-gray-500">▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-44 rounded-md border bg-white shadow z-50"
          role="menu"
        >
          <a
            href="/change-password"
            className="block px-3 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Change password
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
