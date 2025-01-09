import mongoose from "mongoose";

const { Schema } = mongoose;

const thirdPartyCompanySchema = new Schema(
  {
    companyName: {
      type: String,
      required: true,
    },
    companyLocation: {
      type: String,
      required: true,
    },
    companyContact: {
      type: String,
      required: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeInfo",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ThirdPartyCompany = mongoose.model(
  "ThirdPartyCompany",
  thirdPartyCompanySchema
);

export default ThirdPartyCompany;
