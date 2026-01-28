// models/Agent.js
import mongoose from "mongoose";

const AgentSchema = new mongoose.Schema(
  {
    agentGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentGroup",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    areaName: { type: String, trim: true },

    mobile: { type: String, trim: true },
    nid: { type: String, trim: true },

    image: {
      url: String,
      thumbnailUrl: String,
    },

    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.Agent || mongoose.model("Agent", AgentSchema);
