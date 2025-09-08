// models/Person.js
import mongoose from "mongoose";

// Now includes CONTACT
export const PERSON_CATEGORIES = [
  "COMMITTEE",
  "RENOWNED",
  "COMMUNICATE",
  "CONTACT",
];

const PersonSchema = new mongoose.Schema(
  {
    // SCOPING
    // For COMMITTEE / RENOWNED / COMMUNICATE: area is REQUIRED
    // For CONTACT: area or center may be provided, or both null (global contact)
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

    // CORE FIELDS
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" }, // optional extra
    email: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    importance: { type: Number, default: 0, min: 0, max: 999 },

    category: {
      type: String,
      enum: PERSON_CATEGORIES,
      required: true,
      index: true,
    },

    // COMMITTEE-only helpers
    committeeName: { type: String, trim: true, default: "" }, // group name
    position: { type: String, trim: true, default: "" }, // role in committee
    order: { type: Number, default: 0 }, // sort within committee

    // CONTACT/COMMUNICATE helpers
    tags: { type: [String], default: [] }, // e.g. ["press","security"]
    notes: { type: String, trim: true, default: "" },
    isFavorite: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Validation: require area for non-CONTACT categories
PersonSchema.pre("validate", function (next) {
  if (this.category !== "CONTACT" && !this.area) {
    return next(
      new Error("area is required for COMMITTEE/RENOWNED/COMMUNICATE")
    );
  }
  next();
});

// Useful indexes
PersonSchema.index({ area: 1, category: 1, committeeName: 1, order: 1 });
PersonSchema.index({ center: 1, category: 1, importance: -1 });
PersonSchema.index({
  name: "text",
  designation: "text",
  notes: "text",
  tags: "text",
});

export default mongoose.models.Person || mongoose.model("Person", PersonSchema);
