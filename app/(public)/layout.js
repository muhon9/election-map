// app/(dash)/layout.js
import "../globals.css";
import Providers from "../providers";
import DashboardShell from "@/components/DashboardShell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const metadata = { title: "Election Dashboard" };

export default async function DashLayout({ children }) {
  const session = await getServerSession(authOptions);
  const perms = session?.user?.permissions || [];
  const showAdmin =
    perms.includes("manage_users") || perms.includes("manage_roles");

  return (
    <html lang="en">
      <head>
        {/* Force light color scheme for the whole document */}
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        <Providers>
          <DashboardShell showAdmin={showAdmin}>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
