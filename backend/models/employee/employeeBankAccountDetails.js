import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    unique: true,
  },
  accountHolderName: {
    type: String,
  },
  ifscCode: {
    type: String,
  },
  upiId: {
    type: String,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmployeeInfo",
    required: true,
  },
});

const employeeBankAccountDetails = mongoose.model(
  "employeeBankAccountDetails",
  accountSchema
);

export default employeeBankAccountDetails;
