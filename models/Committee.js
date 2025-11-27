// models/Committee.js
import mongoose from "mongoose";

const { Schema, models, model, Types } = mongoose;

const FileSchema = new Schema(
  {
    url: { type: String, required: true }, // where the file is served from
    filename: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes
    thumbnailUrl: { type: String, default: "" }, // first-page/thumb preview (optional)
    uploadedBy: { type: Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now },
    docDate: { type: Date, default: null }, // date printed on the document (optional)
    source: { type: String, default: "" }, // provenance, e.g., "EC list", "Party memo"
  },
  { _id: false }
);

const CommitteeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    // --- Geography (use validateGeoChain() in routes; model stays neutral) ---
    cityId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    upazillaId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    unionId: { type: Types.ObjectId, ref: "GeoUnit", default: null },
    wardId: { type: Types.ObjectId, ref: "GeoUnit", default: null },

    // Optional: directly link to specific centers (when applicable)
    centers: [{ type: Types.ObjectId, ref: "Center", default: null }],
    areaId: { type: Types.ObjectId, ref: "Area", default: null },

    // Attachments: PDFs/JPEGs/PNGs of the committee list
    files: { type: [FileSchema], default: [] },

    // Optional period (term)
    period: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },

    // Free text notes
    notes: { type: String, default: "" },

    // Optional OCR text to enable search; fill during/after upload
    ocrText: { type: String, default: "" },
  },
  { timestamps: true }
);

// Helpful indexes for quick filtering
CommitteeSchema.index({ name: "text", ocrText: "text" }); // full-text search
CommitteeSchema.index({ cityId: 1, wardId: 1, createdAt: -1 });
CommitteeSchema.index({ upazillaId: 1, unionId: 1, wardId: 1, createdAt: -1 });
CommitteeSchema.index({ "files.uploadedAt": -1 });

// Ensure only one model is compiled (Next.js hot reload friendly)
export default models.Committee || model("Committee", CommitteeSchema);
