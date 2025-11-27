// models/Person.js
import mongoose from "mongoose";

export const PERSON_CATEGORIES = [
  "COMMITTEE",
  "RENOWNED",
  "COMMUNICATE",
  "CONTACT",
];

const PersonSchema = new mongoose.Schema(
  {
    // SCOPING
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      index: true,
      default: null,
    },
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      index: true,
      default: null,
    },

    // NEW: link to Committee (one person belongs to one committee)
    committeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Committee",
      index: true,
      default: null,
    },

    // CORE FIELDS
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    importance: { type: Number, default: 0, min: 0, max: 999 },

    category: {
      type: String,
      enum: PERSON_CATEGORIES,
      required: true,
      index: true,
    },

    // COMMITTEE-only helpers (still ok to keep)

    position: { type: String, trim: true, default: "" },
    order: { type: Number, default: 0 },

    // CONTACT/COMMUNICATE helpers
    tags: { type: [String], default: [] },
    notes: { type: String, trim: true, default: "" },
    isFavorite: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Validation: require area for non-CONTACT,
// and require committeeId for COMMITTEE persons
PersonSchema.pre("validate", function (next) {
  if (
    this.category !== "CONTACT" &&
    this.category !== "COMMITTEE" &&
    !this.area
  ) {
    return next(
      new Error("area is required for COMMITTEE/RENOWNED/COMMUNICATE")
    );
  }

  if (this.category === "COMMITTEE" && !this.committeeId) {
    return next(new Error("committeeId is required for COMMITTEE persons"));
  }

  next();
});

// Useful indexes
PersonSchema.index({ area: 1, category: 1, committeeId: 1, order: 1 });
PersonSchema.index({ center: 1, category: 1, importance: -1 });
PersonSchema.index({
  name: "text",
  designation: "text",
  notes: "text",
  tags: "text",
});

export default mongoose.models.Person || mongoose.model("Person", PersonSchema);
