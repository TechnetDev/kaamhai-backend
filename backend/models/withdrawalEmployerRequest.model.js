import { Schema, model } from "mongoose";

const withdrawalRequestSchema = new Schema(
  {
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessAccount",
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
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

export default model("EmployerWithdrawalRequest", withdrawalRequestSchema);
