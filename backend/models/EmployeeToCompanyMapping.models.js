import mongoose from "mongoose";

const employeeToCompanyMappingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EmployeeInfo",
      },
    ],
  },
  { timestamps: true }
);

const EmployeeToCompanyMapping = mongoose.model(
  "EmployeeToCompanyMapping",
  employeeToCompanyMappingSchema
);

export default EmployeeToCompanyMapping;
