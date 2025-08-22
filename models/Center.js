import mongoose from "mongoose";

const PersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: String,
    designation: String,
    importance: { type: Number, default: 0, min: 0, max: 10 },
    notes: String,
  },
  { _id: true, timestamps: true }
);

const AreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: String,
    people: [PersonSchema],
  },
  { _id: true, timestamps: true }
);

const CenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    contact: { name: String, phone: String },
    notes: String,

    totalVoters: { type: Number, default: 0, min: 0 },
    maleVoters: { type: Number, default: 0, min: 0 },
    femaleVoters: { type: Number, default: 0, min: 0 },

    // NEW
    areas: [AreaSchema],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CenterSchema.index({ lat: 1, lng: 1 });
CenterSchema.index({ name: 1 });
CenterSchema.index({ "areas.name": 1, "areas.people.name": 1 });

export default mongoose.models.Center || mongoose.model("Center", CenterSchema);
