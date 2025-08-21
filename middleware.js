import { withAuth } from "next-auth/middleware";

export default withAuth(
  () => {},
  {
    pages: { signIn: "/login" },
    callbacks: { authorized: ({ token }) => !!token },
  }
);

// Protect dashboard routes (route group paths are flattened in URL)
export const config = {
  matcher: [
    "/",                  // homepage
    "/centers/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/change-password",
  ],
};
