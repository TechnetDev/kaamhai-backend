import mongoose from "mongoose";

const { Schema, model } = mongoose;

const requestSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employees: [
      {
        employeeId: {
          type: Schema.Types.ObjectId,
          ref: "EmployeeInfo",
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
      },
    ],
    totalRequests: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to calculate totalRequests before saving
requestSchema.pre("save", function (next) {
  this.totalRequests = this.employees.length;
  next();
});

const Request = model("Request", requestSchema);

export default Request;