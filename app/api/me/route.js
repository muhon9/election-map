// app/api/me/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// GET /api/me  -> current user's profile
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  await dbConnect();
  const doc = await User.findById(session.user.id)
    .populate("role", "name level permissions")
    .lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  return Response.json({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email || "",
    phone: doc.phone || "",
    role: doc.role ? { name: doc.role.name, level: doc.role.level } : null,
  });
}

// PATCH /api/me
// Accepts: { email?, phone?, currentPassword?, newPassword? }
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  await dbConnect();
  const body = await req.json().catch(() => ({}));

  const updates = {};
  // email / phone (optional)
  if (typeof body.email === "string") {
    const email = body.email.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
      });
    }
    updates.email = email;
  }
  if (typeof body.phone === "string") {
    updates.phone = body.phone.trim();
  }

  // password change (optional)
  if (body.currentPassword || body.newPassword) {
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({
          error: "Both currentPassword and newPassword are required",
        }),
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "New password must be at least 8 characters" }),
        { status: 400 }
      );
    }

    // Load user with password for verification
    const userDoc = await User.findById(session.user.id).select("+password");
    if (!userDoc) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    }
    const ok = await bcrypt.compare(currentPassword, userDoc.password || "");
    if (!ok) {
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        { status: 400 }
      );
    }

    updates.password = await bcrypt.hash(newPassword, 10);
    updates.passwordChangedAt = new Date();
  }

  try {
    const saved = await User.findByIdAndUpdate(session.user.id, updates, {
      new: true,
    }).lean();
    if (!saved) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    }
    return Response.json({
      id: saved._id.toString(),
      username: saved.username,
      email: saved.email || "",
      phone: saved.phone || "",
    });
  } catch (e) {
    // Handle duplicate email (Mongo E11000)
    if (e?.code === 11000 && e?.keyPattern?.email) {
      return new Response(JSON.stringify({ error: "Email already in use" }), {
        status: 409,
      });
    }
    return new Response(JSON.stringify({ error: "Update failed" }), {
      status: 500,
    });
  }
}
