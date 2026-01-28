"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import UserBadge from "@/components/UserBadge";

export default function DashboardShell({ children, showAdmin }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = [
    { href: "/", label: "Map Viewer" },
    { href: "/centers", label: "Centers" },
    { href: "/agent-groups", label: "Agents" },
    { href: "/areas", label: "Areas" },
    { href: "/area-map", label: "Areas Map" },
    { href: "/geo/list", label: "Ward / Union" },
    { href: "/committees", label: "Committees" },
    // ...(showAdmin ? [{ href: "/areas", label: "Areas" }] : []),
    // { href: "/mosq-map", label: "Mosq Map" },
    // { href: "/mosqs", label: "Mosqs" },
    { href: "/persons", label: "Persons" },
    { href: "/stats", label: "Stats" },
    // ...(showAdmin ? [{ href: "/persons", label: "Persons" }] : []),
    ...(showAdmin ? [{ href: "/users", label: "Users" }] : []),
    ...(showAdmin ? [{ href: "/roles", label: "Rules" }] : []),
    ...(showAdmin ? [{ href: "/geo", label: "Administration" }] : []),
    ...(showAdmin ? [{ href: "/backup", label: "Backup" }] : []),
    ...(showAdmin
      ? [{ href: "/committee-types", label: "Committee Types" }]
      : []),
    // { href: "/settings", label: "Settings" },
  ];

  const NavItem = ({ href, label }) => {
    const active =
      pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`block px-3 py-2 rounded-md text-sm transition ${
          active ? "bg-gray-900 text-white" : "text-gray-800 hover:bg-gray-100"
        }`}
        onClick={() => setOpen(false)}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="h-14 flex items-center justify-between px-3">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-50"
            aria-label="Open menu"
          >
            <div className="space-y-1.5">
              <span className="block w-5 h-0.5 bg-gray-800" />
              <span className="block w-5 h-0.5 bg-gray-800" />
              <span className="block w-5 h-0.5 bg-gray-800" />
            </div>
          </button>

          <Link href="/" className="font-semibold">
            Election Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <UserBadge />
          </div>
        </div>
      </header>

      {/* Overlay (mobile) */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity md:hidden z-40 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer / Sidebar */}
      <aside
        className={`
          fixed z-50 top-0 left-0 h-full w-56 bg-white border-r p-3
          transform transition-transform md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between h-14 border-b mb-3">
          <span className="font-semibold">Menu</span>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-50"
            aria-label="Close menu"
          >
            <span className="sr-only">Close</span>
            <span className="block w-4 h-4 rotate-45 border-r-2 border-b-2 border-gray-800 -mr-1 -mb-1" />
          </button>
        </div>

        <nav className="space-y-1">
          {nav.map((n) => (
            <NavItem key={n.href} {...n} />
          ))}
        </nav>
      </aside>

      {/* Reserve sidebar width on desktop */}
      <div className="hidden md:block md:fixed md:top-0 md:left-0 md:h-full md:w-56" />

      {/* Main content */}
      <main className="md:ml-56 p-4">{children}</main>
    </div>
  );
}
