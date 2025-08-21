// app/api/auth/[...nextauth]/route.js (v4)
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import "@/models/Role";         // ensure Role model is registered
import User from "@/models/User";

export const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  jwt: { maxAge: 60 * 60 * 24 * 60 },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { username: {}, password: {} },
      authorize: async (creds) => {
        await dbConnect();
        const user = await User.findOne({ username: creds.username }).populate("role");
        console.log("user", user);
        if (!user) return null;

        const ok = await bcrypt.compare(creds.password, user.password);
        if (!ok) return null;
        
        const roleId = user.role?._id?.toString() || null;
        const roleName = user.role?.name || null;
        const permissions = Array.isArray(user.role?.permissions) ? user.role.permissions : [];

        return {
          user: user,
          id: user._id.toString(),
          username: user.username,
          roleId,
          roleName,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.username = user.username;
        token.roleId = user.roleId || null;
        token.roleName = user.roleName || null;
        token.permissions = user.permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid,
        username: token.username,
        roleId: token.roleId || null,     // ← keep the ObjectId (string)
        roleName: token.roleName || null, // ← human-readable
        permissions: token.permissions || [],
      };
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
