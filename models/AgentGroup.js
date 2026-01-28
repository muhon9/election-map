import mongoose from "mongoose";

const { Schema, models, model, Types } = mongoose;

const AgentGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    center: {
      type: Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// helpful indexes
AgentGroupSchema.index({ center: 1, createdAt: -1 });
AgentGroupSchema.index({ name: "text" });

export default models.AgentGroup || model("AgentGroup", AgentGroupSchema);
