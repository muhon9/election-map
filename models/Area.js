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

    // GeoJSON polygon / multipolygon for this area (same style as GeoUnit)
    shape: {
      type: {
        type: String,
        enum: ["Polygon", "MultiPolygon"],
        default: undefined,
      },
      // For Polygon:   [ [ [lng, lat], ... ] ]
      // For MultiPoly: [ [ [ [lng, lat], ... ] ] ]
      coordinates: {
        type: Array,
        default: undefined, // omit field if empty, keeps docs clean
      },
      // Optional: original GeoJSON from geojson.io if you want to keep it
      rawGeoJSON: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined,
      },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// full-text search
AreaSchema.index({ name: "text", code: "text" });

// geo index for polygon queries (contains, intersect, etc.)
AreaSchema.index({ shape: "2dsphere" });

export default mongoose.models.Area || mongoose.model("Area", AreaSchema);
