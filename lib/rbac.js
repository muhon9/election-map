export function hasPerm(session, perm) {
  return !!session?.user?.permissions?.includes(perm);
}

export function withPermApi(handler, perm) {
  // if perm is "*", allow it for public access
  if (perm === "*") {
    return handler;
  }

  // Toggle ACL with env: set ENABLE_ACL=1 to enforce
  const enforce = process.env.ENABLE_ACL === "1";
  return async (...args) => {
    if (!enforce) return handler(...args); // ACL off for now
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await getServerSession(authOptions);
    if (!hasPerm(session, perm)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }
    return handler(...args, session);
  };
}
