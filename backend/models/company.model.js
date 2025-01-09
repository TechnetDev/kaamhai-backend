import mongoose from "mongoose";
const { Schema } = mongoose;
const branchSchema = new mongoose.Schema({
  plotNo: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
});

const companySchema = new mongoose.Schema(
  {
    companylocationdetails: {
      States: { type: String },
      city: { type: String },
      googlemaplink: { type: String },
      houseno: { type: String },
      pincode: { type: String },
      street: { type: String },
    },
    companyprofile: {
      businessname: { type: String, required: true },
      chain: { type: Number, default: 0 },
      industry: { type: String },
      category: { type: String },
      //industry: { type: Schema.Types.ObjectId, ref: 'Industry', required: true },
      //category: { type: Schema.Types.ObjectId, ref: 'Industry.categories._id' },
      logo: {
        name: { type: String },
        uri: { type: String },
      },
      backgroundPhoto: { type: String },
      mode: { type: String },
    },
    compbasicdetails: {
      additionallicence: {
        name: { type: String },
        uri: { type: String },
      },
      document: {
        name: { type: String },
        uri: { type: String },
      },
      companysize: { type: String },
      docs: { type: String },
      docstype: { type: String },
      employeeno: { type: String },
      hrnumber: { type: String },
      ownernumber: { type: String },
      additionalImages: [{ type: String }],
      // role: { type: String, required: true },
      typesofentity: {
        _index: { type: Number },
        label: { type: String },
        value: { type: String },
      },
    },
    branches: [branchSchema],
    yearOfEstablishment: { type: Number },
    contactNumber: { type: String },
    createdBy: { type: String },
    isCompleted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["approved", "rejected", "under evaluation"],
      default: "under evaluation",
    },
    UID: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

companySchema.virtual("branchCount").get(function () {
  return this.branches.length;
});

// Ensure virtual fields are serialized.
companySchema.set("toJSON", { virtuals: true });
companySchema.set("toObject", { virtuals: true });

export default mongoose.model("Company", companySchema);
