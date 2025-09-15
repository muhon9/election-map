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
  // scripts/seed-roles-and-admin.js (excerpt)
  await Role.updateOne(
    { name: "super_admin" },
    {
      $set: {
        permissions: [
          "manage_users",
          "manage_roles",
          "view_centers",
          "edit_center",
          "view_areas",
          "edit_area",
          "view_people",
          "edit_people",
        ],
        level: 0,
        immutable: true,
      },
    },
    { upsert: true }
  );
  await Role.updateOne(
    { name: "admin" },
    {
      $set: {
        permissions: [
          "manage_users",
          "manage_roles",
          "view_centers",
          "edit_center",
          "view_areas",
          "edit_area",
          "view_people",
          "edit_people",
        ],
        level: 10,
      },
    },
    { upsert: true }
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
