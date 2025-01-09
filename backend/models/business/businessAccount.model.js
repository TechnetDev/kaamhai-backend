import mongoose from "mongoose";

const businessAccountSchema = new mongoose.Schema(
  {
    basicDetails: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
      },
      phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },
    },
          fcmToken: {
    type: String,
    default: '',
  },
    address: {
      plotNo: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
      },
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    role: {
      type: String,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
          referralCode: {
      type: String,
      unique: true,
    },
    wallet: {
      type: Number,
      default: 0, // Default wallet balance
    },
    totalEarned: {
      type: Number,
      default: 0, // Default wallet balance
    },
    referredBy: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['approved', 'rejected', 'under evaluation'],
      default: 'under evaluation',
    },
    referral: {
      type: String,
    },
credits: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const BusinessAccount = mongoose.model("BusinessAccount", businessAccountSchema);

export default BusinessAccount;