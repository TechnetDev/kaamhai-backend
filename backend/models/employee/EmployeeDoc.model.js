import { Schema, model } from "mongoose";

const EmployeeDocumentSchema = new Schema({
  id: {
    type: String,
    unique: true,
  },
  aadharCard: {
    front: {
      filename: { type: String },
      contentType: { type: String },
      uri: { type: String },
      fileCopyUri: { type: String, default: "" },
    },
    back: {
      filename: { type: String },
      contentType: { type: String },
      uri: { type: String },
      fileCopyUri: { type: String, default: "" },
    },
    aadharNumber: {
      type: String,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  facePhoto: {
    filename: { type: String },
    contentType: { type: String },
    uri: { type: String },
    fileCopyUri: { type: String, default: "" },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
});

export default model("EmployeeDocument", EmployeeDocumentSchema);
