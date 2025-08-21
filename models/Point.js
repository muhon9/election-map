import mongoose from "mongoose";
const PointSchema = new mongoose.Schema({
  name: String,
  description: String,
  lat: Number,
  lng: Number,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
export default mongoose.models.Point || mongoose.model("Point", PointSchema);
