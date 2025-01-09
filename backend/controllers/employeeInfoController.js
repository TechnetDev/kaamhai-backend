import asyncHandler from "../handlers/asyncHandler.js";
import EmployeeDocModel from "../models/employee/EmployeeDoc.model.js";
import { generateSaveQRCodePNG } from "../utils/qrCode.js";
import EmployeeToCompanyMapping from "../models/EmployeeToCompanyMapping.models.js";
import companyModel from "../models/company.model.js";
import Request from "../models/companyEmployeeRequest.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import ThirdPartyCompany from "../models/thirdPartyCompanies.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import offerLetterModel from "../models/offerLetter.model.js";
import Company from "../models/company.model.js";
import RevokeContractLetter from "../models/revokeOfferLetter/revokeContractLetter.model.js";
import mongoose from "mongoose";
const { ObjectId } = mongoose;
import BusinessAccount from "../models/business/businessAccount.model.js";
import ReferralModel from "../models/userReferral.model.js";
import WithdrawalRequest from "../models/withdrawalUserRequest.model.js";
import employeeBankAccountDetails from "../models/employee/employeeBankAccountDetails.js";
import JobPostApplication from "../models/jobPosts/jobPostApplications.model.js";
import {
  sendNotification,
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";

const handleEmployeeInfoUpdate = async (req, res) => {
  try {
    const userId = req.employeeId;
    const {
      professionalPreferences,
      education,
      workExperience,
      personalInfo,
      spokenLanguages,
    } = req.body;

    let employeeInfoData = await EmployeeInfoModel.findOne({ id: userId });

    if (!employeeInfoData) {
      return res
        .status(404)
        .json({ message: "Employee information not found" });
    }

    if (education) {
      employeeInfoData.education = education; // Assign the single value directly
      employeeInfoData.educationIsCompleted = true;
    }

    if (spokenLanguages) {
      employeeInfoData.spokenLanguages = spokenLanguages;
    }

    if (professionalPreferences) {
      if (!employeeInfoData.professionalPreferences) {
        employeeInfoData.professionalPreferences = {};
      }
      Object.assign(
        employeeInfoData.professionalPreferences,
        professionalPreferences
      );
      employeeInfoData.professionalPreferences.isCompleted = true;
    }

    if (workExperience) {
      if (!employeeInfoData.workExperience) {
        employeeInfoData.workExperience = [];
      }
      workExperience.forEach((work) => {
        employeeInfoData.workExperience.push(work); // Append new work experiences
      });
      if (workExperience.length > 0) {
        employeeInfoData.experienceIsCompleted = true;
      }
    }

    if (personalInfo) {
      // Added personalInfo update logic
      if (!employeeInfoData.personalInfo) {
        employeeInfoData.personalInfo = {};
      }
      Object.assign(employeeInfoData.personalInfo, personalInfo);
      employeeInfoData.personalInfo.isCompleted = true;
    }

    await employeeInfoData.save();

    // Fetch the updated employee data after saving
    const updatedEmployeeInfo = await EmployeeInfoModel.findOne({ id: userId });

    res.status(200).json({
      message: "User information updated successfully",
      employeeInfo: updatedEmployeeInfo,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating info",
      error: error.message,
    });
  }
};

const getReferralDetails = async (req, res) => {
  try {
    const employeeId = req.employeeId;

    // Fetch employee data using the employeeId from the request
    const employeeData = await EmployeeInfoModel.findOne(
      { id: employeeId },
      "_id totalEarned id"
    );
    if (!employeeData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employeeObjectId = employeeData._id;
    const employeeInfoId = employeeData.id; // The custom ID used for job post applications

    // Find the referrer using the employee's object ID
    const referralData = await ReferralModel.findOne({
      referrerEmployeeId: employeeObjectId,
    }).populate("referees");
    if (!referralData) {
      return res
        .status(404)
        .json({ message: "No referral data found for this employee ID" });
    }

    const totalLinkedEmployees = referralData.referees.length;

    console.log(employeeId);
    console.log(employeeObjectId);
    // Calculate total number of withdrawal requests for the employee's object ID
    const withdrawalRequests = await WithdrawalRequest.find({
      employeeId: employeeId,
    }).countDocuments();
    console.log(withdrawalRequests);
    // Initialize paidPending count
    let paidPending = 0;

    // Fetch detailed information of each referred employee
    const refereesDetails = await Promise.all(
      referralData.referees.map(async (referee) => {
        // Fetch the employee's `id` field to use for job post applications
        const refereeInfo = await EmployeeInfoModel.findOne(
          { _id: referee._id },
          "personalInfo.name personalInfo.phoneNumber createdAt id"
        );
        if (!refereeInfo) {
          console.log(`Referee not found for ID: ${referee._id}`);
          return null;
        }

        // Use the `id` from `EmployeeInfo` to find job post applications
        console.log(
          `Checking job post application for referee ID: ${refereeInfo.id}`
        );
        const firstJobPostApplication = await JobPostApplication.findOne({
          employeeId: refereeInfo.id,
        }).sort({ createdAt: 1 });

        // If no job post application is found, count as pending payment
        if (!firstJobPostApplication) {
          paidPending += 1;
          console.log(
            `No job post application found for referee ID: ${refereeInfo.id}, indicating pending payment.`
          );
        }

        return {
          name: refereeInfo.personalInfo.name,
          phoneNumber: refereeInfo.personalInfo.phoneNumber,
          employeeCreatedAt: refereeInfo.createdAt,
          firstJobPostApplicationCreatedAt: firstJobPostApplication
            ? firstJobPostApplication.createdAt
            : null,
        };
      })
    );

    res.json({
      totalLinkedEmployees,
      totalWithdrawalRequests: withdrawalRequests,
      totalEarned: employeeData.totalEarned,
      refereesDetails: refereesDetails.filter((detail) => detail !== null),
      paidPending, // Return the count of referees with no job post applications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEmployeeTransactions = async (req, res) => {
  const employeeId = req.employeeId;

  try {
    // Find employee details
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Get employee's name
    const employeeName = employee.personalInfo.name;

    // Fetch totalEarned and wallet amounts
    const totalEarned = employee.totalEarned || 0;
    const walletAmount = employee.wallet || 0;

    // Find all withdrawal requests by this employee
    const withdrawals = await WithdrawalRequest.find({
      employeeId: employee.id,
    }).sort({ createdAt: -1 }); // Sorted by date, most recent first

    // Format the response
    const transactions = withdrawals.map((withdrawal) => ({
      transactionId: withdrawal._id,
      employeeName,
      state: withdrawal.state,
      withdrawalAmount: withdrawal.withdrawalAmount,
      requestDate: withdrawal.createdAt.toISOString(),
    }));
    console.log(transactions);
    // Send the response
    res.json({
      totalEarned,
      walletAmount,
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getEmployeeInfo = asyncHandler(async (req, res) => {
  const userId = req.employeeId;
  console.log(`Fetching employee information for userId: ${userId}`);

  try {
    const employeeInfoData = await EmployeeInfoModel.findOne({ id: userId });
    if (!employeeInfoData) {
      console.log(`Employee information not found for userId: ${userId}`);
      return res
        .status(404)
        .json({ message: "Employee information not found." });
    }

    console.log(
      `Employee information found for userId: ${userId}`,
      employeeInfoData
    );

    const documents = employeeInfoData.documents || [];
    const facePhoto = employeeInfoData.facePhoto;
    const { spokenLanguages, skip } = employeeInfoData; // Include skip

    // Generate signed URLs for documents
    await Promise.all(
      documents.map(async (document) => {
        if (document.isCompleted) {
          if (document.front && document.front.filename) {
            document.front.uri = await generateV4ReadSignedUrl(
              userId,
              document.front.filename
            );
            console.log(
              `Generated signed URL for document front: ${document.front.uri}`
            );
          } else {
            console.log(
              `Document front filename missing for document: ${document}`
            );
          }

          if (document.back && document.back.filename) {
            document.back.uri = await generateV4ReadSignedUrl(
              userId,
              document.back.filename
            );
            console.log(
              `Generated signed URL for document back: ${document.back.uri}`
            );
          } else {
            console.log(
              `Document back filename missing for document: ${document}`
            );
          }
        }
      })
    );

    // Generate signed URL for face photo
    if (facePhoto && facePhoto.isCompleted && facePhoto.filename) {
      facePhoto.uri = await generateV4ReadSignedUrl(userId, facePhoto.filename);
      console.log(`Generated signed URL for face photo: ${facePhoto.uri}`);
    } else if (facePhoto && facePhoto.isCompleted) {
      console.log(`Face photo filename missing for userId: ${userId}`);
    }

    // Fetch the offer letter associated with this employee
    const offerLetter = await offerLetterModel
      .findOne({ employeeId: userId })
      .lean();
    console.log(
      `Offer letter ${
        offerLetter ? "found" : "not found"
      } for employeeId: ${userId}`
    );

    let companyDetailsResponse = null;

    // If offerLetter is found, get the companyId
    if (offerLetter && offerLetter.employerId) {
      const businessAccount = await BusinessAccount.findById(
        offerLetter.employerId
      )
        .populate("companyId")
        .lean();
      const companyId = businessAccount?.companyId?._id;

      if (companyId) {
        const companyDetails = await Company.findById(companyId).lean();
        companyDetailsResponse = companyDetails
          ? {
              companyName: companyDetails.companyprofile.businessname,
              location: companyDetails.companylocationdetails,
            }
          : null;
      }
    }

    // Check if any document is completed
    const isAnyDocumentCompleted = documents.some(
      (document) => document.isCompleted
    );
    const userIdAsObjectId = new mongoose.Types.ObjectId(userId);
    const revokeContractLetter = await RevokeContractLetter.findOne({
      employeeId: userIdAsObjectId,
    }).lean();

    const revokeStatus = revokeContractLetter
      ? revokeContractLetter.status
      : null;

    const bankAccount = await employeeBankAccountDetails
      .findOne({ employeeId: userIdAsObjectId })
      .lean();
    const bankAccountResponse = bankAccount
      ? {
          exists: true,
          details: {
            accountNumber: bankAccount.accountNumber,
            accountHolderName: bankAccount.accountHolderName,
            ifscCode: bankAccount.ifscCode,
            upiId: bankAccount.upiId,
          },
        }
      : { exists: false };

    res.status(200).json({
      ...employeeInfoData.toObject(),
      isCompleted: isAnyDocumentCompleted,
      spokenLanguages: spokenLanguages || [], // Default to empty array if not present
      companyDetails: companyDetailsResponse,
      offerLetter: offerLetter || null, // Include offer letter, default to null if not found
      revokeStatus: revokeStatus || "",
      skip: skip || false, // Include the skip field in the response, default to false if not present
      bankAccount: bankAccountResponse,
    });
  } catch (error) {
    console.error("Error retrieving employee information:", error);
    res
      .status(500)
      .json({ message: "Error retrieving employee information", error });
  }
});

const storeFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.employeeId;
    console.log(`Received FCM token: ${fcmToken} for employee ID: ${userId}`);

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    // Update or create the user's FCM token in the database
    const updateResult = await EmployeeInfoModel.updateOne(
      { id: userId },
      { fcmToken }
    );

    if (updateResult.nModified === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "FCM token stored successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error storing FCM token", error: error.message });
  }
};

const qrCode = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const formattedId = employee.formattedId;
    const url = `https://www.kaamHai.in/profile/${formattedId}`;

    await generateSaveQRCodePNG(url, employeeId);

    const expires = 7 * 24 * 60 * 60 * 1000;
    const signedUrl = await generateV4ReadSignedUrl(
      employeeId,
      `${employeeId}-qrcode.png`,
      expires
    );

    res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
};

/*  Testing QR code locally

const qrCode = async (req, res) => {
  try {
    const employeeId = req.employeeId; 
    const url = `https://www.kaamHai.in/profile/${employeeId}`;

    const filePath = await generateSaveQRCodePNG(url, employeeId);

    res.status(200).json({ filePath });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};
*/

const getAllReferralDetails = async (req, res) => {
  try {
    // Fetch all referrers from the ReferralModel
    const allReferrals = await ReferralModel.find({}).populate("referees");

    if (!allReferrals || allReferrals.length === 0) {
      return res.status(404).json({ message: "No referral data found" });
    }

    const referralDetails = await Promise.all(
      allReferrals.map(async (referralData) => {
        // Fetch referrer's details from EmployeeInfoModel using referrerEmployeeId
        const referrerData = await EmployeeInfoModel.findOne(
          { _id: referralData.referrerEmployeeId },
          "personalInfo.name personalInfo.phoneNumber createdAt id totalEarned"
        );

        if (!referrerData) {
          console.log(
            `Referrer not found for ID: ${referralData.referrerEmployeeId}`
          );
          return null;
        }

        // Process each referee to get detailed information
        const refereesDetails = await Promise.all(
          referralData.referees.map(async (referee) => {
            const refereeInfo = await EmployeeInfoModel.findOne(
              { _id: referee._id },
              "personalInfo.name personalInfo.phoneNumber createdAt id"
            );
            if (!refereeInfo) {
              console.log(`Referee not found for ID: ${referee._id}`);
              return null;
            }

            const firstJobPostApplication = await JobPostApplication.findOne({
              employeeId: refereeInfo.id,
            }).sort({ createdAt: 1 });

            return {
              employeeId: refereeInfo.id,
              name: refereeInfo.personalInfo.name,
              phoneNumber: refereeInfo.personalInfo.phoneNumber,
              employeeCreatedAt: refereeInfo.createdAt,
              firstJobPostApplicationCreatedAt: firstJobPostApplication
                ? firstJobPostApplication.createdAt
                : null,
            };
          })
        );

        return {
          referrerId: referrerData.id,
          referrerName: referrerData.personalInfo.name,
          referrerPhoneNumber: referrerData.personalInfo.phoneNumber,
          referrerCreatedAt: referrerData.createdAt,
          totalEarned: referrerData.totalEarned,
          refereesDetails: refereesDetails.filter((detail) => detail !== null),
        };
      })
    );

    res.json({
      referralDetails: referralDetails.filter((detail) => detail !== null),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const employeeProfileUpdate = asyncHandler(async (req, res) => {
  const {
    description,
    totalExperience,
    workStatus,
    preferredWorkType,
    salaryType,
    workTimings,
    name,
    state,
    phoneNumber,
    dob,
    fatherName,
    bloodGroup,
    emergencyContact,
    localContact,
    insuranceNo,
    mailingAddress,
    address,
    category,
    jobTitle, // Update jobTitle to an array
    skills,
    preferredWorkLocation,
    gender,
    languages, // Add languages field
  } = req.body;
  const userId = req.employeeId;

  try {
    const employeeInfo = await EmployeeInfoModel.findOne({ id: userId });

    if (!employeeInfo) {
      return res
        .status(404)
        .json({ message: "Employee information not found" });
    }

    // Update personalInfo fields
    if (description !== undefined)
      employeeInfo.personalInfo.description = description;
    if (name !== undefined) employeeInfo.personalInfo.name = name;
    if (state !== undefined) employeeInfo.personalInfo.state = state;
    if (phoneNumber !== undefined)
      employeeInfo.personalInfo.phoneNumber = phoneNumber;
    if (dob !== undefined) employeeInfo.personalInfo.dob = dob;
    if (fatherName !== undefined)
      employeeInfo.personalInfo.fatherName = fatherName;
    if (bloodGroup !== undefined)
      employeeInfo.personalInfo.bloodGroup = bloodGroup;
    if (emergencyContact !== undefined)
      employeeInfo.personalInfo.emergencyContact = emergencyContact;
    if (localContact !== undefined)
      employeeInfo.personalInfo.localContact = localContact;
    if (insuranceNo !== undefined)
      employeeInfo.personalInfo.insuranceNo = insuranceNo;
    if (mailingAddress !== undefined)
      employeeInfo.personalInfo.mailingAddress = mailingAddress;
    if (address !== undefined) employeeInfo.personalInfo.address = address;
    if (gender !== undefined) employeeInfo.personalInfo.gender = gender;

    // Update professionalPreferences fields
    if (totalExperience !== undefined)
      employeeInfo.professionalPreferences.totalExperience = totalExperience;
    if (category !== undefined)
      employeeInfo.professionalPreferences.category = category;
    if (jobTitle !== undefined)
      employeeInfo.professionalPreferences.jobTitle = jobTitle; // Update jobTitle to an array
    if (skills !== undefined)
      employeeInfo.professionalPreferences.skills = skills;
    if (preferredWorkLocation !== undefined)
      employeeInfo.professionalPreferences.preferredWorkLocation =
        preferredWorkLocation;
    if (workTimings !== undefined)
      employeeInfo.professionalPreferences.workTimings = workTimings;
    if (salaryType !== undefined)
      employeeInfo.professionalPreferences.salaryType = salaryType;
    if (preferredWorkType !== undefined)
      employeeInfo.professionalPreferences.preferredWorkType =
        preferredWorkType;

    // Update languages field
    if (languages !== undefined) employeeInfo.spokenLanguages = languages;

    // Update workStatus
    if (workStatus !== undefined) employeeInfo.workStatus = workStatus;

    await employeeInfo.save();

    res.status(200).json({
      message: "Employee profile updated successfully",
      employee: employeeInfo,
    });
  } catch (error) {
    console.error("Error updating employee profile:", error);
    res.status(500).json({
      message: "Error updating employee profile",
      error: error.message,
    });
  }
});

const updateWorkStatus = asyncHandler(async (req, res) => {
  const { employeeId } = req;
  const { status } = req.query;

  console.log(
    `Updating work status for employeeId: ${employeeId} to ${status}`
  );

  if (!["already working", "open to work"].includes(status)) {
    return res.status(400).json({ message: "Invalid work status" });
  }

  try {
    const employeeInfo = await EmployeeInfoModel.findOneAndUpdate(
      { id: employeeId },
      { workStatus: status },
      { new: true }
    );

    if (!employeeInfo) {
      console.log(`Employee not found for id: ${employeeId}`);
      return res.status(404).json({ message: "Employee not found" });
    }

    res
      .status(200)
      .json({
        message: `Employee's work status successfully updated to ${status}`,
      });
  } catch (error) {
    console.error(`Error updating work status for id: ${employeeId}`, error);
    res.status(500).json({ message: "Error updating work status", error });
  }
});

const sendEmployeeCompanyRequest = asyncHandler(async (req, res) => {
  const employeeId = req.employeeId;
  const { companyId } = req.params;

  const company = await companyModel.findById(companyId);
  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  const companyName = company.companyprofile.businessname;

  const employee = await EmployeeInfoModel.findOne({ id: employeeId });
  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  employee.companyLinkRequestStatus = "pending";
  await employee.save();

  let existingRequest = await Request.findOne({ companyId });

  if (existingRequest) {
    const alreadyRequested = existingRequest.employees.some(
      (emp) => emp.employeeId.toString() === employee.id.toString()
    );
    if (alreadyRequested) {
      return res
        .status(400)
        .json({
          message: "Employee has already requested to link with this company",
        });
    }

    existingRequest.employees.push({
      employeeId: employee.id,
      status: "pending",
    });
    await existingRequest.save();

    // Find the BusinessAccount with the same companyId
    const businessAccount = await BusinessAccount.findOne({ companyId });
    if (businessAccount) {
      const employeeName = employee.personalInfo.name;
      const title = `New Link Request from ${employeeName}`;
      const message = `${employeeName} has requested to join the company ${companyName}.`;

      await createNotification(employeeId, companyId, message, "company"); // Log the notification
      await sendPushNotification(businessAccount.fcmToken, title, message); // Send push notification using FCM token
    }

    return res.status(200).json({
      message: `Request to link employee to company ${companyName} has been updated successfully.`,
      requestId: existingRequest._id,
    });
  } else {
    const newRequest = new Request({
      companyId,
      employees: [{ employeeId: employee.id, status: "pending" }],
    });

    await newRequest.save();

    // Find the BusinessAccount with the same companyId
    const businessAccount = await BusinessAccount.findOne({ companyId });
    if (businessAccount) {
      const employeeName = employee.personalInfo.name;
      const title = `New Link Request from ${employeeName}`;
      const message = `${employeeName} has requested to join the company ${companyName}.`;

      await createNotification(employeeId, companyId, message, "company"); // Log the notification
      await sendPushNotification(businessAccount.fcmToken, title, message); // Send push notification using FCM token
    }

    return res.status(200).json({
      message: `Request to link employee to company ${companyName} has been sent successfully.`,
      requestId: newRequest._id,
    });
  }
});

const submitThirdPartyCompany = asyncHandler(async (req, res) => {
  const employeeId = req.employeeId;
  const { companyName, companyLocation, companyContact } = req.body;

  // Step 1: Validate employee existence
  const employee = await EmployeeInfoModel.findOne({ id: employeeId });

  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  // Step 2: Create a new third-party company record
  const thirdPartyCompany = new ThirdPartyCompany({
    companyName,
    companyLocation,
    companyContact,
    submittedBy: employee._id,
  });

  await thirdPartyCompany.save();

  // Step 3: Response
  res.status(200).json({
    message: `Third-party company ${companyName} details have been submitted successfully.`,
    companyId: thirdPartyCompany._id,
  });
});

const generateRandomNumber = () => {
  return Math.floor(100 + Math.random() * 900); // Generates a number between 100 and 999
};

const updateFreeSubscription = asyncHandler(async (req, res) => {
  const employeeId = req.employeeId;

  try {
    const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId });

    if (!employeeInfo) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Generate paymentID in the format "KHE-XXX"
    const paymentID = `KHE-${generateRandomNumber()}`;

    employeeInfo.freeSubscription = {
      paymentID,
      paymentMethod: "coupon", // Hardcoded paymentMethod
      updatedAt: new Date(),
    };
    employeeInfo.plan = "premium";
    await employeeInfo.save();

    res.status(201).json(employeeInfo.freeSubscription);
  } catch (error) {
    console.error("Error updating free subscription:", error);
    res
      .status(500)
      .json({
        message: "Error updating free subscription",
        error: error.message,
      });
  }
});

const updateSkipStatus = async (req, res) => {
  const userId = req.employeeId; // Extract employeeId from JWT token
  console.log(`Fetching employee information for userId: ${userId}`);

  try {
    // Find the employee by the userId
    const employeeInfo = await EmployeeInfoModel.findOne({ id: userId });

    if (!employeeInfo) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Update the skip field to true
    employeeInfo.skip = true;

    // Save the updated employee info
    await employeeInfo.save();

    return res.status(200).json({ message: "Skip field updated successfully" });
  } catch (error) {
    console.error("Error updating skip field:", error);
    return res
      .status(500)
      .json({ message: "Error updating skip field", error });
  }
};

const getEmployeeDocumentCounts = async (req, res) => {
  try {
    // Count users who have only facePhoto
    const facePhotoOnlyCount = await EmployeeInfoModel.countDocuments({
      "facePhoto.uri": { $ne: null, $ne: "" }, // Checks if facePhoto exists
      $or: [
        { "documents.aadhaarNumber": { $exists: false } },
        { "documents.aadhaarNumber": { $eq: "" } },
      ],
    });

    // Count users who have only aadhaarNumber
    const aadhaarOnlyCount = await EmployeeInfoModel.countDocuments({
      "documents.aadhaarNumber": { $ne: null, $ne: "" }, // Checks if aadhaarNumber exists
      $or: [
        { "facePhoto.uri": { $exists: false } },
        { "facePhoto.uri": { $eq: "" } },
      ],
    });

    // Count users who have both facePhoto and aadhaarNumber
    const bothCount = await EmployeeInfoModel.countDocuments({
      "facePhoto.uri": { $ne: null, $ne: "" }, // Checks if facePhoto exists
      "documents.aadhaarNumber": { $ne: null, $ne: "" }, // Checks if aadhaarNumber exists
    });

    // Return the counts in the response
    res.status(200).json({
      facePhotoOnlyCount,
      aadhaarOnlyCount,
      bothCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error retrieving document counts",
        error: error.message,
      });
  }
};

export {
  getEmployeeInfo,
  handleEmployeeInfoUpdate,
  qrCode,
  employeeProfileUpdate,
  updateWorkStatus,
  sendEmployeeCompanyRequest,
  updateFreeSubscription,
  submitThirdPartyCompany,
  getReferralDetails,
  getEmployeeTransactions,
  getAllReferralDetails,
  updateSkipStatus,
  storeFcmToken,
  getEmployeeDocumentCounts,
};
