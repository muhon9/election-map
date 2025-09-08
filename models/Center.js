import mongoose from "mongoose";

const CenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    address: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    // overall voters at center level
    totalVoters: { type: Number, default: 0 },
    maleVoters: { type: Number, default: 0 },
    femaleVoters: { type: Number, default: 0 },

    contact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    notes: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CenterSchema.index({
  name: "text",
  address: "text",
  "contact.name": "text",
  "contact.phone": "text",
});

export default mongoose.models.Center || mongoose.model("Center", CenterSchema);
