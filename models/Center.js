import mongoose from "mongoose";

const CenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    address: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    // overall voters at center level
    totalVoters: { type: Number, default: 0 },
    maleVoters: { type: Number, default: 0 },
    femaleVoters: { type: Number, default: 0 },

    contact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
    }, // type: city_corporation
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
    }, // type: city_ward

    // Rural path
    upazilaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
    }, // type: upazila
    unionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeoUnit",
      index: true,
    },
    // ruralWard: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "GeoUnit",
    //   index: true,
    // }, // type: rural_ward

    notes: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CenterSchema.index({ cityCorp: 1, cityWard: 1 });
CenterSchema.index({ upazila: 1, union: 1, ruralWard: 1 });

CenterSchema.index({
  name: "text",
  address: "text",
  "contact.name": "text",
  "contact.phone": "text",
});

// Virtual: areas belonging to this center
CenterSchema.virtual("areas", {
  ref: "Area",
  localField: "_id",
  foreignField: "center",
  justOne: false,
});

export default mongoose.models.Center || mongoose.model("Center", CenterSchema);
