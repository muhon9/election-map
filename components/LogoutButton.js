"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton({ className = "" }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`px-3 py-2 rounded border hover:bg-gray-50 ${className}`}
    >
      Logout
    </button>
  );
}
