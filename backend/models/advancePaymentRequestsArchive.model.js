import mongoose from "mongoose";

const { Schema } = mongoose;

const ArchiveAdvancePaymentSchema = new Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeInfo",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    availableBalance: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    admin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Export the LeaveRequest model
const ArchivePaymentRequest = mongoose.model(
  "ArchivePaymentRequest",
  ArchiveAdvancePaymentSchema
);

export default ArchivePaymentRequest;
