import mongoose from "mongoose";
const RoleSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  permissions: [{ type: String, required: true }],
}, { timestamps: true });

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);
