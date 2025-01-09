import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    senderId: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    title: {
      type: String,
    },
    receiverType: {
      type: String,
      enum: ["employee", "company"],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default model("Notification", notificationSchema);
