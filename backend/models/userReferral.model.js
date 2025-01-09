import { Schema, model } from "mongoose";

const referralSchema = new Schema(
  {
    referrerEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeInfo",
      required: true,
      unique: true,
    },
    referees: [
      {
        type: Schema.Types.ObjectId,
        ref: "EmployeeInfo",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default model("ReferralModel", referralSchema);
