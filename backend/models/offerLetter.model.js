import mongoose from "mongoose";

const offerLetterSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    jobTitle: { type: String, required: true },
    grossSalary: { type: Number, required: true },
    salary: { type: Number, required: true },
    dailyWage: { type: Number },
    startDate: { type: String, required: true },
    workTimings: { type: String, required: true }, // e.g., "9 AM to 5 PM"
    preferredWorkType: {
      type: String,
      enum: ["FullTime", "PartTime"],
      required: true,
    }, // Working mode
    salaryType: {
      type: String,
      enum: ["Weekly", "Hourly", "Monthly", "Daily"],
      required: true,
    }, // How salary is calculated
    weeklyOff: {
      isProvided: { type: String, enum: ["Yes", "No"], required: true },
      numberOfDays: { type: Number, default: 0 },
    },
    foodAllowance: {
      type: {
        type: String,
        enum: ["Lunch Cards/Duty", "MealSnacks & Beverages", "Food Stipends"],
        required: true,
      },
      amount: {
        type: Number,
        required: function () {
          return this.foodAllowance.type === "Food Stipends";
        },
      }, // Conditionally required if type is Food Stipends
    },
    accommodationAllowance: {
      description: String,
      amount: Number,
    },
    otherAllowances: [
      {
        description: String,
        amount: Number,
      },
    ],
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost" },
    status: {
      type: String,
      enum: ["Accepted", "Rejected", "Pending"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("OfferLetter", offerLetterSchema);
