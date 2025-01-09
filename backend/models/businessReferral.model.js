import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const employerReferralSchema = new Schema(
  {
    referrerEmployerId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessAccount", // This references the BusinessAccount model
      required: true,
    },
    referees: [
      {
        type: Schema.Types.ObjectId,
        ref: "BusinessAccount", // This references the BusinessAccount model for the referees
      },
    ],
  },
  {
    timestamps: true,
  }
);

const EmployerReferralModel =
  models.EmployerReferralModel ||
  model("EmployerReferralModel", employerReferralSchema);

export default EmployerReferralModel;
