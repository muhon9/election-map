// models/Mosq.js
import mongoose from "mongoose";

const MosqSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    address: { type: String, trim: true },

    //centerId: { type: mongoose.Schema.Types.ObjectId, ref: "Center", index: true, required: true },
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      index: true,
      default: null,
    },

    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      index: true,
      default: null,
    },

    // Old geo refs (GeoUnit.name)

    // New geo refs (GeoUnit._id)
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
      default: null,
    },
    upazillaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
      default: null,
    },
    unionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
      default: null,
    },
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
      default: null,
    },

    // Optional contact/meta
    contact: { type: String, trim: true },

    // Location snapshot (optional)
    location: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// full-text helpers
MosqSchema.index({ name: "text", address: "text" });

export default mongoose.models.Mosq || mongoose.model("Mosq", MosqSchema);
