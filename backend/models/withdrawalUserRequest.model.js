import { Schema, model } from "mongoose";
import mongoose from "mongoose";
const withdrawalRequestSchema = new Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeInfo",
      required: true,
    },
    state: {
      type: String,
      enum: ["approved", "rejected", "pending"],
      default: "pending",
    },
    withdrawalAmount: {
      type: Number,
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin", // Assuming you have an Admin model
    },
  },
  {
    timestamps: true,
  }
);

export default model("WithdrawalRequest", withdrawalRequestSchema);
