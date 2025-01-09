import { Schema, model } from "mongoose";

const employeeInfoSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    formattedId: String,
    companyLinkRequestStatus: {
      type: String,
      enum: ["approved", "rejected", "pending", ""],
      default: "",
    },
    fcmToken: {
      type: String,
      default: "",
    },
    personalInfo: {
      name: String,
      state: String,
      phoneNumber: String,
      dob: String,
      description: String,
      fatherName: String, // Added
      bloodGroup: String, // Added
      emergencyContact: {
        name: String,
        contactNumber: String,
        relationship: String,
      }, // Updated
      localContact: {
        name: String,
        contactNumber: String,
        relationship: String,
      }, // Updated
      insuranceNo: String, // Added
      mailingAddress: String, // Added
      address: String, // Added
      gender: String,
      isCompleted: {
        type: Boolean,
        default: false,
      },
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
      default: "",
    },
    companyLinkRequestStatus: {
      type: String,
      enum: ["approved", "rejected", "pending", ""],
      default: "",
    },
    manuallyInsertedCompanyDetails: {
      type: Boolean,
      default: false,
    },
    companyRequestData: {
      requestedCompanyName: {
        type: String,
        default: "",
      },
    },
    professionalPreferences: {
      category: { type: String },
      jobTitle: { type: [String] },
      skills: [String],
      preferredWorkLocation: [String],
      preferredWorkType: { type: String, enum: ["FullTime", "PartTime", ""] },
      totalExperience: Number,
      workTimings: { type: String },
      salaryType: {
        type: String,
        enum: ["Weekly", "Hourly", "Monthly", "Daily", ""],
        default: "",
      },
      isCompleted: {
        type: Boolean,
        default: false,
      },
      gender: {
        type: String,
        default: "",
      },
    },
    education: String,
    educationIsCompleted: {
      type: Boolean,
      default: false,
    },
    workExperience: [
      {
        companyName: String,
        location: String,
        designation: String,
        preferredWorkType: { type: String, enum: ["FullTime", "PartTime", ""] },
        yearOfExperienceFrom: String,
        yearOfExperienceTo: String,
      },
    ],
    experienceIsCompleted: {
      type: Boolean,
      default: false,
    },
    workStatus: {
      type: String,
      enum: ["already working", "open to work"],
      default: "open to work",
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    companyName: {
      type: String,
    },
    documents: [
      {
        type: {
          type: String,
          enum: [
            "aadhaarCard",
            "passport",
            "drivingLicense",
            "voterId",
            "panCard",
            "rationCard",
            "other",
          ],
        },
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
        aadhaarNumber: {
          type: String,
          required: function () {
            return this.type === "aadhaarCard";
          },
        },
        isCompleted: {
          type: Boolean,
          default: false,
        },
      },
    ],
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
    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    freeSubscription: {
      paymentID: String,
      paymentMethod: String,
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    spokenLanguages: [String],
  },
  {
    timestamps: true,
  }
);

export default model("EmployeeInfo", employeeInfoSchema);
