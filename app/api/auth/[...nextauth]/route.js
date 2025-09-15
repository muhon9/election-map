// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import "@/models/Role"; // ensure Role model is registered
import User from "@/models/User";

/**
 * Helper to load a user w/ role populated and return a compact session payload
 */
async function loadUserPayload(usernameOrId, byId = false) {
  await dbConnect();
  const query = byId ? { _id: usernameOrId } : { username: usernameOrId };
  const user = await User.findOne(query).populate("role");
  if (!user) return null;

  // optional flags on your model:
  // user.disabled === true  -> block sign in
  if (user.disabled) return { blocked: true };

  const role = user.role || {};
  const roleId = role?._id?.toString() || null;
  const roleName = role?.name || null;
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  const roleLevel = typeof role?.level === "number" ? role.level : 100;
  const roleUpdatedAt = role?.updatedAt
    ? new Date(role.updatedAt).toISOString()
    : null;

  return {
    id: user._id.toString(),
    username: user.username,
    // security metadata
    passwordChangedAt: user.passwordChangedAt
      ? new Date(user.passwordChangedAt).toISOString()
      : null,
    // role/perm snapshot
    roleId,
    roleName,
    roleLevel,
    roleUpdatedAt,
    permissions,
  };
}

export const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 }, // 60 days
  jwt: { maxAge: 60 * 60 * 24 * 60 },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { username: {}, password: {} },
      authorize: async (creds) => {
        // Normalize input
        const username = (creds?.username || "").trim();
        const password = creds?.password || "";
        if (!username || !password) return null;

        await dbConnect();
        // Fetch user for password verification
        const userDoc = await User.findOne({ username })
          .select("+password")
          .populate("role");
        if (!userDoc) return null;
        if (userDoc.disabled) return null;

        const ok = await bcrypt.compare(password, userDoc.password || "");
        if (!ok) return null;

        // Build the payload from the doc we already have
        const role = userDoc.role || {};
        const payload = {
          id: userDoc._id.toString(),
          username: userDoc.username,
          passwordChangedAt: userDoc.passwordChangedAt
            ? new Date(userDoc.passwordChangedAt).toISOString()
            : null,
          roleId: role?._id?.toString() || null,
          roleName: role?.name || null,
          roleLevel: typeof role?.level === "number" ? role.level : 100,
          roleUpdatedAt: role?.updatedAt
            ? new Date(role.updatedAt).toISOString()
            : null,
          permissions: Array.isArray(role?.permissions) ? role.permissions : [],
        };
        return payload;
      },
    }),
  ],
  callbacks: {
    /**
     * JWT callback:
     * - on signIn: seed token from user payload
     * - on subsequent runs: optionally resync role/permissions every ~15 min
     * - enforce passwordChangedAt invalidation
     */
    async jwt({ token, user, trigger }) {
      // On sign in — seed token
      if (user) {
        token.uid = user.id;
        token.username = user.username;
        token.roleId = user.roleId || null;
        token.roleName = user.roleName || null;
        token.roleLevel =
          typeof user.roleLevel === "number" ? user.roleLevel : 100;
        token.permissions = Array.isArray(user.permissions)
          ? user.permissions
          : [];
        token.roleUpdatedAt = user.roleUpdatedAt || null;
        token.passwordChangedAt = user.passwordChangedAt || null;
        token.lastSync = Date.now(); // ms timestamp for periodic resync
        return token;
      }

      // Invalidate tokens if password changed after token was issued.
      // We can't access iat reliably in all runtimes, so compare to a cached value and resync frequently.
      // Periodic refresh every 15 minutes
      const NEEDS_REFRESH_MS = 15 * 60 * 1000;
      const now = Date.now();
      if (
        !token.lastSync ||
        now - token.lastSync > NEEDS_REFRESH_MS ||
        trigger === "update"
      ) {
        // Try to resync the latest role/permissions/passwordChangedAt
        const fresh = await loadUserPayload(token.uid, true);
        if (!fresh || fresh.blocked) {
          // If user no longer exists or is blocked, drop permissions to empty
          token.permissions = [];
          token.roleName = null;
          token.roleId = null;
          token.roleLevel = 100;
          token.roleUpdatedAt = null;
          token.lastSync = now;
          return token;
        }

        // If password changed since last snapshot, you can also force a sign-out on the client
        // by marking a flag; or just keep token state updated here:
        token.username = fresh.username;
        token.roleId = fresh.roleId;
        token.roleName = fresh.roleName;
        token.roleLevel = fresh.roleLevel;
        token.permissions = fresh.permissions;
        token.roleUpdatedAt = fresh.roleUpdatedAt;
        token.passwordChangedAt = fresh.passwordChangedAt;
        token.lastSync = now;
      }

      return token;
    },

    /**
     * Session callback: expose a clean session.user object
     */
    async session({ session, token }) {
      session.user = {
        id: token.uid,
        username: token.username,
        roleId: token.roleId || null,
        roleName: token.roleName || null,
        roleLevel: typeof token.roleLevel === "number" ? token.roleLevel : 100,
        permissions: Array.isArray(token.permissions) ? token.permissions : [],
      };
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
