import BusinessAccount from "../models/business/businessAccount.model.js";
import Company from "../models/company.model.js";
import asyncHandler from "../handlers/asyncHandler.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import BusinessBankAccountDetails from "../models/business/businessBankAccount.model.js"

const getEmployerProfile = asyncHandler(async (req, res) => {
  try {
    const employerID = req.employerId;

    const businessAccount = await BusinessAccount.findById(employerID).select('-password');
    if (!businessAccount) {
      return res.status(404).json({        message: "Business account does not exist. Please create a business account.",
      });
    }

    let company = null;
    if (businessAccount.companyId) {
      company = await Company.findById(businessAccount.companyId).lean();
      if (company && company.companyprofile && company.companyprofile.logo) {
        const { logo } = company.companyprofile;
        company.companyprofile.logoUri = logo.uri;
        company.companyprofile.logoName = logo.name;
        delete company.companyprofile.logo;
      }
    }

const bankAccount = await BusinessBankAccountDetails.findOne({ businessId: employerID }).lean();

    const response = {
      businessAccount: {
        basicDetails: {
          fullName: businessAccount.basicDetails.fullName,
          phoneNumber: businessAccount.basicDetails.phoneNumber,
          email: businessAccount.basicDetails.email,
        },
        address: {
          plotNo: businessAccount.address.plotNo,
          city: businessAccount.address.city,
          state: businessAccount.address.state,
          pincode: businessAccount.address.pincode,
        },
        companyId: businessAccount.companyId,
        role: businessAccount.role,
        isCompleted: businessAccount.isCompleted,
        isVerified: businessAccount.isVerified,
        status: businessAccount.status,
        referral: businessAccount.referral,
        credits: businessAccount.credits,
        createdAt: businessAccount.createdAt,
        updatedAt: businessAccount.updatedAt,
        __v: businessAccount.__v,
      },
      company: company ? {
        companylocationdetails: company.companylocationdetails,
        companyprofile: {
          businessname: company.companyprofile.businessname,
          chain: company.companyprofile.chain,
          industry: company.companyprofile.industry,
          category: company.companyprofile.category,
          logoUri: company.companyprofile.logoUri,
          logoName: company.companyprofile.logoName,
          mode: company.companyprofile.mode,
        },
        compbasicdetails: company.compbasicdetails,
        _id: company._id,
        yearOfEstablishment: company.yearOfEstablishment,
        createdBy: company.createdBy,
        isCompleted: company.isCompleted,
        status: company.status,
        UID: company.UID,
        branches: company.branches,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        __v: company.__v,
      } : null,
     bankAccountDetails: bankAccount ? { exists: true, details: bankAccount } : { exists: false },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default getEmployerProfile;