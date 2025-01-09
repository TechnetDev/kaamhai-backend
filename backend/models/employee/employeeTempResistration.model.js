import mongoose from "mongoose";

const tempRegistrationSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  name: { type: String, required: true },
  referralCode: { type: String, sparse: true },
  referredBy: { type: String },
  state: { type: String, required: true },
  dob: { type: String, required: true },
  otp: { type: String },
  verificationSid: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "60s" },
});

const TempRegistration = mongoose.model(
  "TempRegistration",
  tempRegistrationSchema
);
export default TempRegistration;
