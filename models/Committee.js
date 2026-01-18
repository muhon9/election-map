// models/Committee.js
import mongoose from "mongoose";
import CommitteeType from "./CommitteeType";

const { Schema, models, model, Types } = mongoose;

const FileSchema = new Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: "" },
    uploadedBy: { type: Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now },
    docDate: { type: Date, default: null },
    source: { type: String, default: "" },
  },
  { _id: false },
);

const CommitteeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },

    // ✅ Committee Type (new)
    // Option A (recommended): reference CommitteeType by _id
    typeId: {
      type: Types.ObjectId,
      ref: "CommitteeType",
      default: null,
      index: true,
    },
    typeKey: { type: String, default: "", index: true },

    // Optional: cache key/name for fast filtering even if typeId is null
    // (safe for legacy data; you can ignore this if you only want typeId)
    // typeKey: {
    //   type: String,
    //   default: "",
    //   trim: true,
    //   uppercase: true,
    //   index: true, // e.g. "RENOWNED"
    // },

    // --- Geography ---
    cityId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    upazilaId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    unionId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    wardId: { type: Types.ObjectId, ref: "GeoUnit", default: null },

    // Optional: directly link to specific centers (when applicable)
    centers: [{ type: Types.ObjectId, ref: "Center", default: null }],
    areas: [{ type: Types.ObjectId, ref: "Area", default: null }],

    // Attachments
    files: { type: [FileSchema], default: [] },

    // Optional period (term)
    period: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },

    notes: { type: String, default: "" },
    ocrText: { type: String, default: "" },
  },
  { timestamps: true },
);

// Indexes
CommitteeSchema.index({ name: "text", ocrText: "text" });
CommitteeSchema.index({ typeId: 1, createdAt: -1 });
CommitteeSchema.index({ typeKey: 1, createdAt: -1 });
CommitteeSchema.index({ cityId: 1, wardId: 1, createdAt: -1 });
CommitteeSchema.index({ upazilaId: 1, unionId: 1, wardId: 1, createdAt: -1 });
CommitteeSchema.index({ "files.uploadedAt": -1 });

export default models.Committee || model("Committee", CommitteeSchema);
