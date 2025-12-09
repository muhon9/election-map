import mongoose from "mongoose";
import Center from "./Center";

const AreaSchema = new mongoose.Schema(
  {
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },

    name: { type: String, required: true, index: true },
    code: { type: String, default: "" },

    // voters at area level
    totalVoters: { type: Number, default: 0 },
    maleVoters: { type: Number, default: 0 },
    femaleVoters: { type: Number, default: 0 },

    notes: { type: String, default: "" },

    // -------- GEO SHAPES --------
    // Polygon or MultiPolygon (optional)
    shape: {
      type: {
        type: String,
        enum: ["Polygon", "MultiPolygon"],
        default: undefined,
      },
      coordinates: {
        type: Array,
        default: undefined,
      },
      rawGeoJSON: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined,
      },
    },

    // -------- FALLBACK POINT --------
    // If polygon is not available, show a marker
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
      // [lng, lat]
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Text search
AreaSchema.index({ name: "text", code: "text" });

// Geo indexes
AreaSchema.index({ shape: "2dsphere" });
AreaSchema.index({ location: "2dsphere" });

export default mongoose.models.Area || mongoose.model("Area", AreaSchema);
