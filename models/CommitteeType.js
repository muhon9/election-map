import mongoose from "mongoose";

const { Schema, models, model } = mongoose;

const CommitteeTypeSchema = new Schema(
  {
    // Stable identifier used in Committee (never change once used)
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true, // e.g. "RENOWNED", "WARD_COMMITTEE"
    },

    // Display name (can be Bangla / English)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional UI helpers
    color: {
      type: String,
      default: "", // e.g. "#2563eb"
    },
    icon: {
      type: String,
      default: "", // optional icon name or emoji
    },

    // Sorting order in dropdowns & lists
    sort: {
      type: Number,
      default: 0,
      index: true,
    },

    // Enable / disable without deleting
    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Notes for admins
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Helpful compound index
CommitteeTypeSchema.index({ active: 1, sort: 1 });

export default models.CommitteeType ||
  model("CommitteeType", CommitteeTypeSchema);
