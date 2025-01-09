import asyncHandler from "../handlers/asyncHandler.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import Request from "../models/companyEmployeeRequest.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import EmployeeToCompanyMapping from "../models/EmployeeToCompanyMapping.models.js";
import OfferLetter from "../models/offerLetter.model.js";
import Company from "../models/company.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import RevokeContractLetter from "../models/revokeOfferLetter/revokeContractLetter.model.js";
import {
  sendNotification,
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";

export const rejectEmployeeCompanyRequest = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { companyId } = req.body;

  let request = await Request.findOne({ companyId });

  if (!request) {
    return res
      .status(404)
      .json({ message: "Request not found for the specified company" });
  }

  const employeeRequest = request.employees.find(
    (emp) => emp.employeeId.toString() === employeeId
  );

  if (!employeeRequest) {
    return res.status(404).json({ message: "Employee request not found" });
  }

  employeeRequest.status = "rejected";
  await request.save();

  const employee = await EmployeeInfoModel.findOne({ id: employeeId });

  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  employee.companyLinkRequestStatus = "rejected";
  await employee.save();

  // Send notification to the employee
  const message = `Your request to link with the company has been rejected.`;

  try {
    await createNotification(employeeId, null, message, "employee"); // Adjust the function to create the notification
    await sendPushNotification(employee.fcmToken, "Request Rejected", message); // Assuming the employee has an fcmToken
  } catch (error) {
    console.error(`Failed to send notification: ${error.message}`);
    // Optionally, you can log the error or handle it as necessary
  }

  return res
    .status(200)
    .json({ message: "Employee request has been rejected successfully" });
});

export const acceptEmployeeCompanyRequest = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  const {
    employeeId,
    jobTitle,
    grossSalary,
    salary,
    startDate,
    workTimings,
    preferredWorkType,
    salaryType,
    weeklyOff,
    foodAllowance,
    accommodationAllowance,
    otherAllowances,
    adId,
  } = req.body;

  const missingFields = [];
  if (!employeeId) missingFields.push("employeeId");
  if (!employerId) missingFields.push("employerId");
  if (!jobTitle) missingFields.push("jobTitle");
  if (!startDate) missingFields.push("startDate");
  if (!salaryType) missingFields.push("salaryType");
  if (!foodAllowance || !foodAllowance.type)
    missingFields.push("foodAllowance.type");
  if (!grossSalary) missingFields.push("grossSalary");
  if (missingFields.length > 0) {
    return res
      .status(400)
      .json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
  }

  try {
    const offerLetter = await OfferLetter.create({
      employerId,
      employeeId,
      jobTitle,
      grossSalary,
      salary,
      startDate,
      salaryType,
      workTimings,
      preferredWorkType,
      weeklyOff,
      foodAllowance,
      accommodationAllowance,
      otherAllowances,
      adId,
    });

    const businessAccount = await BusinessAccount.findById(employerId).populate(
      "companyId"
    );
    if (!businessAccount || !businessAccount.companyId) {
      return res
        .status(404)
        .json({ message: "Company not found for the employer" });
    }

    const companyId = businessAccount.companyId._id;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyName = company.companyprofile.businessname;
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const request = await Request.findOneAndUpdate(
      { companyId, "employees.employeeId": employeeId },
      { $set: { "employees.$.status": "accepted" } },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    employee.companyLinkRequestStatus = "approved";
    employee.companyId = companyId;
    employee.companyName = companyName;
    employee.workStatus = "already working";

    const existingMapping = await EmployeeToCompanyMapping.findOne({
      companyId,
    });

    if (!existingMapping) {
      await EmployeeToCompanyMapping.create({
        companyId,
        employees: [employeeId],
      });
    } else {
      await EmployeeToCompanyMapping.findOneAndUpdate(
        { companyId },
        { $addToSet: { employees: employeeId } },
        { new: true }
      );
    }

    await employee.save();

    // Send notification to the employee
    const message = `Congratulations! Your request to link with the company ${companyName} has been accepted.`;

    try {
      await createNotification(employeeId, null, message, "employee"); // Adjust the function to create the notification
      await sendPushNotification(
        employee.fcmToken,
        "Request Accepted",
        message
      ); // Assuming the employee has an fcmToken
    } catch (error) {
      console.error(`Failed to send notification: ${error.message}`);
      // Optionally, you can log the error or handle it as necessary
    }

    res.status(201).json({
      message: "Offer letter created successfully",
      offerLetter,
      companyId,
      employeeId,
      companyName,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

export const getCompanyRequestsAndMappings = asyncHandler(async (req, res) => {
  const employerId = req.employerId;

  try {
    // Step 1: Find the company associated with the employerId
    const businessAccount = await BusinessAccount.findById(employerId).populate(
      "companyId"
    );

    if (!businessAccount || !businessAccount.companyId) {
      return res
        .status(404)
        .json({ message: "Company not found for the employer" });
    }

    const companyId = businessAccount.companyId._id;

    // Step 2: Retrieve the Request model data for this company
    const requests = await Request.findOne({ companyId }).lean();

    // Step 3: Retrieve the EmployeeToCompanyMapping model data for this company
    const employeeMappings = await EmployeeToCompanyMapping.findOne({
      companyId,
    }).lean();

    // Step 4: If no data found
    if (!requests && !employeeMappings) {
      return res.status(404).json({ message: "No data found for the company" });
    }

    // Helper function to generate V4 signed URLs for face photos
    const getSignedFacePhotoUrl = async (facePhoto, employeeId) => {
      if (facePhoto && facePhoto.filename) {
        return await generateV4ReadSignedUrl(
          String(employeeId),
          facePhoto.filename
        );
      }
      return facePhoto.uri; // Return original URI if no filename is present
    };

    // Step 5: Fetch EmployeeInfo for each employee in the request
    if (requests && requests.employees.length > 0) {
      requests.employees = await Promise.all(
        requests.employees.map(async (employee) => {
          const employeeInfo = await EmployeeInfoModel.findOne({
            id: employee.employeeId,
          }).lean();

          if (employeeInfo) {
            // Replace the facePhoto.uri with the V4 signed URL
            if (employeeInfo.facePhoto) {
              try {
                employeeInfo.facePhoto.uri = await getSignedFacePhotoUrl(
                  employeeInfo.facePhoto,
                  employee.employeeId
                );
              } catch (error) {
                console.error(
                  `Error generating signed URL for face photo of employee ${employee.employeeId}:`,
                  error.message
                );
              }
            }
          }

          return {
            ...employee,
            employeeInfo,
          };
        })
      );
    }

    // Step 6: Fetch EmployeeInfo for each employee in the employeeMappings
    if (employeeMappings && employeeMappings.employees.length > 0) {
      employeeMappings.employees = await Promise.all(
        employeeMappings.employees.map(async (employeeId) => {
          const employeeInfo = await EmployeeInfoModel.findOne({
            id: employeeId,
          }).lean();
          if (employeeInfo) {
            // Replace the facePhoto.uri with the V4 signed URL
            if (employeeInfo.facePhoto) {
              try {
                employeeInfo.facePhoto.uri = await getSignedFacePhotoUrl(
                  employeeInfo.facePhoto,
                  employeeId
                );
              } catch (error) {
                console.error(
                  `Error generating signed URL for face photo of employee ${employeeId}:`,
                  error.message
                );
              }
            }
          }

          return {
            employeeId,
            employeeInfo,
          };
        })
      );
    }

    // Step 7: Retrieve the RevokeContractLetter data for this company
    const revokeContractLetters = await RevokeContractLetter.find({ companyId })
      .populate("offerLetterId")
      .lean();

    // Step 8: Process facePhoto in revokeContractLetters using employeeId from offerLetterId
    if (revokeContractLetters.length > 0) {
      await Promise.all(
        revokeContractLetters.map(async (letter) => {
          if (letter.offerLetterId && letter.offerLetterId.employeeId) {
            const employeeId = letter.offerLetterId.employeeId;
            // Fetch the EmployeeInfo based on the employeeId
            const employeeInfo = await EmployeeInfoModel.findOne({
              id: employeeId,
            }).lean();

            if (employeeInfo) {
              // Replace the facePhoto.uri with the V4 signed URL, if facePhoto exists
              if (employeeInfo.facePhoto) {
                try {
                  employeeInfo.facePhoto.uri = await getSignedFacePhotoUrl(
                    employeeInfo.facePhoto,
                    employeeId
                  );
                  letter.facePhoto = employeeInfo.facePhoto;
                } catch (error) {
                  console.error(
                    `Error generating signed URL for face photo of employee ${employeeId}:`,
                    error.message
                  );
                }
              } else {
                letter.facePhoto = null;
              }

              // Attach the employeeInfo to the letter
              letter.employeeInfo = employeeInfo;
            } else {
              console.log(
                `No EmployeeInfo found for employeeId: ${employeeId}`
              );
              letter.facePhoto = null;
              letter.employeeInfo = null;
            }
          } else {
            console.log(
              `No employeeId found in offerLetterId for letter: ${letter._id}`
            );
            letter.facePhoto = null;
            letter.employeeInfo = null;
          }
        })
      );
    }

    // Step 9: Send the data as a response
    res.status(200).json({
      requests,
      employeeMappings,
      revokeContractLetters, // Include the revoke contract letters data with face photos updated
    });
  } catch (error) {
    console.error("Internal server error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});
