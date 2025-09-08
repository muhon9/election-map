import mongoose from "mongoose";

const AreaSchema = new mongoose.Schema(
  {
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },
    name: { type: String, required: true, index: true },
    code: { type: String, default: "" }, // optional identifier

    // voters at area level
    totalVoters: { type: Number, default: 0 },
    maleVoters: { type: Number, default: 0 },
    femaleVoters: { type: Number, default: 0 },

    notes: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AreaSchema.index({ name: "text", code: "text" });

export default mongoose.models.Area || mongoose.model("Area", AreaSchema);
