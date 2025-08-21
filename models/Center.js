import mongoose from "mongoose";

const CenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    contact: {
      name: String,
      phone: String,
    },

    notes: String,

    // NEW fields
    totalVoters: { type: Number, default: 0, min: 0 },
    maleVoters: { type: Number, default: 0, min: 0 },
    femaleVoters: { type: Number, default: 0, min: 0 },

    // optional audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CenterSchema.index({ lat: 1, lng: 1 });

export default mongoose.models.Center || mongoose.model("Center", CenterSchema);
