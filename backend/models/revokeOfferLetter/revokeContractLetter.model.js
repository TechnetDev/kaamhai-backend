import mongoose from "mongoose";

const revokeContractLetterSchema = new mongoose.Schema(
  {
    noticePeriod: {
      type: String,
      required: true,
    },
    offerLetterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OfferLetter",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeInfo",
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeRole: {
      type: String,
      required: true,
    },
    employeeJoiningDate: {
      type: String,
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reasons: {
      type: [String],
      required: true,
    },
    additionalNote: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "RevokeContractLetter",
  revokeContractLetterSchema
);
