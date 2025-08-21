// Simple helpers for server & API routes
export function hasPerm(session, perm) {
  return !!session?.user?.permissions?.includes(perm);
}

export function requirePerm(session, perm) {
  if (!hasPerm(session, perm)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

// Wrap API handlers to enforce permissions & return proper JSON
export function withPermApi(handler, perm) {
  return async (...args) => {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const req = args[0]; // Next.js App Router: (req, { params })
    const session = await getServerSession(authOptions);
    if (!hasPerm(session, perm)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    return handler(...args, session);
  };
}
