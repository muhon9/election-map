// models/Role.js
import mongoose from "mongoose";
const RoleSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true },
    permissions: [{ type: String, required: true }],
    level: { type: Number, required: true, default: 100 }, // lower = more powerful (e.g., 0=superadmin)
  },
  { timestamps: true }
);

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);
