// scripts/seed.js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });  // <— load .env.local

import bcrypt from "bcryptjs";
import dbConnect from "../lib/db.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

console.log("MONGODB_URI present?", !!process.env.MONGODB_URI); // sanity check

await dbConnect();
// ... rest of your seeding code ...


let superRole = await Role.findOne({ name: "super_admin" });
if (!superRole) {
  superRole = await Role.create({
    name: "super_admin",
    permissions: [
      "manage_users","manage_roles","view_map","view_details","view_listings",
      "add_point","edit_point","delete_point","upload_excel"
    ],
  });
}

const username = "admin";
const password = "ChangeMe123";
const hash = await bcrypt.hash(password, 10);

let superUser = await User.findOne({ username });
if (!superUser) {
  await User.create({ username, password: hash, role: superRole._id });
  console.log("Super admin created:", username, "password:", password);
} else {
  console.log("Super admin already exists");
}
process.exit(0);
