import { withPermApi } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import bcrypt from "bcryptjs";

export const POST = withPermApi(async (req) => {
  await dbConnect();
  const { username, password, roleId, email, phone } = await req.json();

  if (!username || !password || !roleId) {
    return new Response(JSON.stringify({ error: "username, password, roleId required" }), { status: 400 });
  }

  const role = await Role.findById(roleId);
  if (!role) return new Response(JSON.stringify({ error: "Invalid roleId" }), { status: 400 });

  const exists = await User.findOne({ username });
  if (exists) return new Response(JSON.stringify({ error: "Username already exists" }), { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password: hash, role: role._id, email, phone });

  return Response.json({
    _id: user._id,
    username: user.username,
    role: { _id: role._id, name: role.name, permissions: role.permissions },
    email: user.email, phone: user.phone, createdAt: user.createdAt
  });
}, "manage_users");
