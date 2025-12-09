import { withAuth } from "next-auth/middleware";

export default withAuth(() => {}, {
  pages: { signIn: "/login" },
  callbacks: { authorized: ({ token }) => !!token },
});

// Protect dashboard routes (route group paths are flattened in URL)
export const config = {
  matcher: [
    "/centers/new",
    "/centers/(.*)/edit",
    "/areas/(.*)/edit",
    "/committees/(.*)/edit",
    "/settings/:path*",
    "/roles/:path*",
    "/mosqs/new",
    "/mosqs/bulk",
    "/geo/",
    "/admin/:path*",
    "/change-password",
  ],
};
