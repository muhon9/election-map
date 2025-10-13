// models/AuditLog.js
import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    // who
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorUsername: String,
    actorRoleName: String,

    // what
    action: {
      type: String,
      enum: ["create", "update", "delete", "role_change", "login", "logout"],
      index: true,
    },
    entityType: { type: String, index: true }, // "user" | "role" | "center" | "area" | "person" | ...
    entityId: { type: String, index: true },
    summary: String,

    // optional diff (redacted server-side)
    diff: {
      fields: [String],
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },

    // request meta
    ip: String,
    userAgent: String,

    // retention (optional TTL if you want)
    // expiresAt: { type: Date, index: { expires: '180d' } },
  },
  { timestamps: { createdAt: "ts", updatedAt: false } }
);

AuditLogSchema.index({ ts: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, ts: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", AuditLogSchema);
