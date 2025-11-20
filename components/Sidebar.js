"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

export default function Sidebar({ showAdmin }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // ✅ Build nav here (conditionally add Admin & Users)
  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/centers", label: "Centers" },
    { href: "/committees", label: "Committees" },
    { href: "/mosqs-map", label: "Mosqs Map" },
    { href: "/mosqs", label: "Mosqs" },
    { href: "/settings", label: "Settings" },
    ...(showAdmin ? [{ href: "/users", label: "Users" }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const Item = ({ href, label }) => {
    const active =
      pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`block px-3 py-2 rounded-md text-sm ${
          active ? "bg-gray-900 text-white" : "text-gray-800 hover:bg-gray-100"
        }`}
        onClick={() => setOpen(false)}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* topbar + hamburger ... (your existing code) */}

      {/* drawer/aside ... (your existing code) */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-72 bg-white border-r p-3`}
      >
        {/* ... header, close button ... */}
        <nav className="space-y-1">
          {navItems.map((it) => (
            <Item key={it.href} {...it} />
          ))}
        </nav>
        <div className="mt-6">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
