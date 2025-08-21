// scripts/seed-roles-and-admin.js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import dbConnect from "../lib/db.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

async function main() {
  await dbConnect();

  // 1) Upsert roles with permissions
  const SUPER = {
    name: "super_admin",
    permissions: [
      "manage_users","manage_roles",
      "view_centers","view_listings",
      "add_center","edit_center","delete_center","upload_excel",
    ],
  };

  const ADMIN = {
    name: "admin",
    permissions: [
      "view_centers","view_listings",
      "add_center","edit_center","delete_center","upload_excel",
      // (no manage_users/roles by default; add if you want)
    ],
  };

  const VIEWER = {
    name: "viewer",
    permissions: ["view_centers","view_listings"],
  };

  const rolesToUpsert = [SUPER, ADMIN, VIEWER];

  const roleDocs = {};
  for (const r of rolesToUpsert) {
    const doc = await Role.findOneAndUpdate(
      { name: r.name },
      { $set: { permissions: r.permissions } },
      { upsert: true, new: true }
    );
    roleDocs[r.name] = doc;
    console.log(`✅ Role upserted: ${r.name}`);
  }

  // 2) Ensure a super admin user exists
  const username = "boss";
  const plain = "ChangeMe123!"; // change in prod and re-run
  const hash = await bcrypt.hash(plain, 10);

  let user = await User.findOne({ username });
  if (!user) {
    user = await User.create({
      username,
      password: hash,
      role: roleDocs.super_admin._id,
      email: "boss@example.com", // optional
    });
    console.log(`✅ Super admin created: ${username} / ${plain}`);
  } else {
    // Make sure boss has super_admin role
    if (!user.role || String(user.role) !== String(roleDocs.super_admin._id)) {
      user.role = roleDocs.super_admin._id;
      await user.save();
      console.log("✅ Boss linked to super_admin role");
    } else {
      console.log("ℹ️ Boss already exists with super_admin");
    }
  }

  // 3) Backfill existing users without a role (optional)
  const withoutRole = await User.find({ role: { $exists: false } });
  if (withoutRole.length) {
    const viewerId = roleDocs.viewer._id;
    await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: viewerId } }
    );
    console.log(`✅ Backfilled ${withoutRole.length} users with viewer role`);
  }

  console.log("🎉 Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
