import mongoose from "mongoose";

const jobPostSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployerAuthModel",
      required: true,
    },
    phoneNumber: { type: String },
    // status: { type: String, enum: ['created', 'pending', 'success', 'failed'], default: 'created' },
    designation: { type: String, required: true },
    salaryPeriod: { type: String },
    positionType: { type: String },
    salaryFrom: { type: Number },
    salaryTo: { type: Number },
    describe: { type: String },
    requirements: { type: String },
    foodAllowance: { type: String },
    location: { type: String },
    accomodationAllowance: { type: String },
    image: {
      name: { type: String },
      size: { type: Number },
      contentType: { type: String },
      uri: { type: String, optional: true },
    },
    requiredEmployees: { type: Number },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessAccount" },
    companyName: { type: String, required: true },
    status: { type: String, enum: ["open", "closed", "live", ""], default: "" },
    closingReason: { type: String },
    isPaymentDone: { type: Boolean, default: false },
    freeSubscription: {
      paymentID: { type: String },
      paymentMethod: { type: String },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

export default mongoose.model("JobPost", jobPostSchema);
