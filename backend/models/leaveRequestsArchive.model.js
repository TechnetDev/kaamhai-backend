import mongoose from "mongoose";

const { Schema } = mongoose;

const ArchiveLeaveRequestSchema = new Schema(
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
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
    },
    totalLeavesAllowed: {
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

const ArchiveLeaveRequest = mongoose.model(
  "ArchiveLeaveRequest",
  ArchiveLeaveRequestSchema
);

export default ArchiveLeaveRequest;
