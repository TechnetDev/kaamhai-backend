import mongoose from "mongoose";

const AadhaarVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmployeeInfo", // Assuming EmployeeInfo is the name of the user model
    required: true,
  },
  refId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  careOf: {
    type: String,
  },
  address: {
    type: String,
    required: true,
  },
  dob: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  splitAddress: {
    country: { type: String, required: true },
    dist: { type: String, required: true },
    house: { type: String },
    landmark: { type: String },
    pincode: { type: String, required: true },
    po: { type: String },
    state: { type: String, required: true },
    street: { type: String },
    subdist: { type: String },
    vtc: { type: String },
  },
  yearOfBirth: {
    type: String,
    required: true,
  },
  mobileHash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("AadhaarVerification", AadhaarVerificationSchema);
