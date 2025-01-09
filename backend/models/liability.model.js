import mongoose from "mongoose";

const liabilitySchema = new mongoose.Schema(
  {
    employeeid: {
      type: mongoose.Schema.Types.ObjectId, // References EmployeeInfo model
      required: true,
      ref: "EmployeeInfo",
    },
    formattedid: {
      type: String, // Ensures uniqueness of each formattedid
    },
    date: {
      type: String,
    },
    itemName: {
      type: String,
    },
    amount: {
      type: Number,
    },
    type: {
      type: String,
      enum: ["item", "leave"], // Two types of liabilities
    },
    liabilityPhoto: {
      filename: { type: String },
      contentType: { type: String },
      uri: { type: String },
      fileCopyUri: { type: String, default: "" },
      isCompleted: {
        type: Boolean,
        default: false,
      },
    },
    leaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest", // References LeaveRequest model
    },
    companyid: {
      type: mongoose.Schema.Types.ObjectId, // References Company model
      required: true,
      ref: "Company",
    },
    status: {
      type: String,
      enum: ["pending", "rejected", "accepted", "dispute"], // Enum for status
      default: "pending", // Default value is 'pending'
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Automatically add createdAt only
  }
);

const Liability = mongoose.model("Liability", liabilitySchema);

export default Liability;
