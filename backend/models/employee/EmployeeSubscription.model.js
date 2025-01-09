import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeAuthModel",
      required: true,
    },
    razorpaySubscriptionId: { type: String, required: true },
    status: { type: String, required: true },
    paymentId: { type: String },
    paymentMethod: { type: String },
    paymentAmount: { type: Number },
  },
  {
    timestamps: true,
  }
);

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;
