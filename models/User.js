import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // bcrypt hash
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  email: String, phone: String,
  passwordChangedAt: Date,
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
