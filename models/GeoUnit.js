// models/GeoUnit.js
import mongoose from "mongoose";

const GeoUnitSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, index: true }, // e.g., upazila, city_corporation, ward, union...
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true }, // optional govt code

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      default: null,
      index: true,
    },

    ancestors: [
      { type: mongoose.Schema.Types.ObjectId, ref: "GeoUnit", index: true },
    ],

    sort: { type: Number, default: 0, index: true },
    active: { type: Boolean, default: true, index: true },

    /**
     * NEW FIELD: GeoJSON Polygon / MultiPolygon
     * This stores boundaries drawn in geojson.io.
     *
     * Example:
     * {
     *   type: "Polygon",
     *   coordinates: [[[lng, lat], [lng, lat], ...]]
     * }
     */
    shape: {
      type: {
        type: String,
        enum: ["Polygon", "MultiPolygon"],
        default: null,
      },
      coordinates: {
        type: Array,
        default: undefined,
      },
    },
  },
  { timestamps: true }
);

// Ensure uniqueness per parent+type+slug
GeoUnitSchema.index({ type: 1, parent: 1, slug: 1 }, { unique: true });

// 2dsphere index for future "inside polygon" / "nearby" features
GeoUnitSchema.index({ shape: "2dsphere" });

// Very simple slugify
GeoUnitSchema.statics.slugify = function (s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

export default mongoose.models.GeoUnit ||
  mongoose.model("GeoUnit", GeoUnitSchema);
