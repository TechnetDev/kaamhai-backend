import asyncHandler from "../handlers/asyncHandler.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import companyModel from "../models/company.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import EmployeeToCompanyMapping from "../models/EmployeeToCompanyMapping.models.js";
import Notification from "../models/notification.model.js";
import OfferLetter from "../models/offerLetter.model.js";
import JobPostApplication from "../models/jobPosts/jobPostApplications.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import {
  sendNotification,
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";
import PDFDocument from "pdfkit";
import axios from "axios";
// @desc    Create offer letter
// @route   POST /api/offer-letters
// @access  Private
const parseDate = (dateString) => {
  const [day, month, year] = dateString.split("-");
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
};

const createOfferLetter = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  const {
    employeeId,
    jobTitle,
    grossSalary,
    salary,
    startDate,
    workTimings,
    preferredWorkType,
    dailyWage,
    salaryType,
    weeklyOff,
    foodAllowance,
    accommodationAllowance,
    otherAllowances,
    adId,
  } = req.body;

  console.log(req.body);

  // Check for missing required fields
  const missingFields = [];
  if (!employeeId) missingFields.push("employeeId");
  if (!employerId) missingFields.push("employerId");
  if (!startDate) missingFields.push("startDate");
  if (!salaryType) missingFields.push("salaryType");
  if (!foodAllowance || !foodAllowance.type)
    missingFields.push("foodAllowance.type");
  if (!grossSalary) missingFields.push("grossSalary");

  // Return error if any required fields are missing
  if (missingFields.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  try {
    // Step 1: Create the offer letter
    const offerLetter = await OfferLetter.create({
      employerId,
      employeeId,
      jobTitle,
      dailyWage,
      grossSalary,
      salary,
      startDate, // save as string directly
      salaryType,
      workTimings,
      preferredWorkType,
      weeklyOff,
      foodAllowance,
      accommodationAllowance,
      otherAllowances,
      adId,
    });

    // Step 2: Find the company associated with the employerId
    const businessAccount = await BusinessAccount.findById(employerId).populate(
      "companyId"
    );
    if (!businessAccount || !businessAccount.companyId) {
      return res
        .status(404)
        .json({ message: "Company not found for the employer" });
    }

    const companyId = businessAccount.companyId._id;
    const companyName = businessAccount.companyId.companyprofile.businessname;
    const employerName = businessAccount.basicDetails.fullName;

    // Step 3: Validate employee existence
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Step 4: Update the job application status if it exists
    const jobApplication = await JobPostApplication.findOne({
      employeeId,
      adId,
    });
    if (jobApplication) {
      jobApplication.status = "shortlisted";
      await jobApplication.save();
    }

    // Step 5: Send a notification to the employee
    const notificationTitle = `New notification from ${companyName}`;
    const notificationMessage = `${employerName} has sent you an offer letter.`;

    try {
      const employeeInfo = await EmployeeInfoModel.findOne({
        id: employeeId,
      }).lean();
      const fcmToken = employeeInfo.fcmToken;

      if (!fcmToken) {
        console.error("FCM token not found for the employee");
        return res
          .status(404)
          .json({ message: "FCM token not found for the employee" });
      }

      // Send push notification
      await sendPushNotification(
        fcmToken,
        notificationTitle,
        notificationMessage
      );

      // Step 6: Create the notification record in the Notification model
      const newNotification = new Notification({
        senderId: employerId, // Employer sending the notification
        receiverId: employeeId, // Employee receiving the notification
        receiverType: "Employee", // Receiver type is 'Employee'
        title: notificationTitle,
        message: notificationMessage,
        isRead: false, // Mark as unread by default
      });
      await newNotification.save();
    } catch (notificationError) {
      console.error("Notification sending failed:", notificationError.message);
      // Log the error but continue processing the response
    }
    // Return the response
    res.status(201).json({
      message: "Offer letter created successfully",
      offerLetter,
      companyId,
      employeeId,
      companyName,
      jobApplicationId: jobApplication ? jobApplication._id : null,
      jobApplicationStatus: jobApplication ? jobApplication.status : null,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Delink company and employee
// @route   DELETE /api/company/delink/:companyId/:employeeId
// @access  Private
const delinkCompanyAndEmployee = asyncHandler(async (req, res) => {
  const { companyId, employeeId } = req.params;

  // Check for missing required params
  if (!companyId || !employeeId) {
    return res
      .status(400)
      .json({ message: "Missing required parameters: companyId, employeeId" });
  }

  try {
    // Step 1: Validate employee existence and current association with the company
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (!employee.companyId || employee.companyId.toString() !== companyId) {
      return res
        .status(400)
        .json({ message: "Employee is not associated with this company" });
    }

    // Step 2: Update the employee to remove the company association
    employee.companyId = null;
    employee.companyName = "";
    employee.workStatus = "open to work";
    await employee.save();

    // Step 3: Update the EmployeeToCompanyMapping to remove the employee from the company's employee list
    await EmployeeToCompanyMapping.findOneAndUpdate(
      { companyId },
      { $pull: { employees: employeeId } },
      { new: true }
    );

    res.status(200).json({
      message: "Employee successfully delinked from the company",
      companyId,
      employeeId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Get offer letters for an employee
// @route   GET company/:companyId/employees
// @access  Private
const getEmployeesByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    const employeeMappings = await EmployeeToCompanyMapping.find({ companyId });

    console.log("Employee Mappings:", employeeMappings); // Log employeeMappings

    if (!employeeMappings || employeeMappings.length === 0) {
      return res
        .status(404)
        .json({ message: "No employees found for the given company" });
    }

    const employeeIds = employeeMappings.reduce((acc, mapping) => {
      if (mapping.employees.length > 0) {
        acc.push(...mapping.employees.map((emp) => emp.toString()));
      }
      return acc;
    }, []);

    console.log("Employee IDs:", employeeIds); // Log employee IDs

    const employees = await EmployeeInfoModel.find({
      id: { $in: employeeIds },
    });

    console.log("Employees:", employees); // Log the retrieved employees

    res.status(200).json({
      message: "Employees retrieved successfully",
      employees: employees,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Get offer letters for an employee
// @route   GET /api/offer-letters/employee/:employeeId
// @access  Private
const getOfferLettersForEmployee = asyncHandler(async (req, res) => {
  try {
    const employeeId = req.employeeId; // Extract employeeId from the token
    const offerLetters = await OfferLetter.find({ employeeId }).populate(
      "adId"
    );

    if (!offerLetters.length) {
      return res
        .status(404)
        .json({ message: "No offer letters found for this employee" });
    }

    const offerLettersWithCompanyDetails = await Promise.all(
      offerLetters.map(async (offerLetter) => {
        const employerId = offerLetter.employerId;
        let companyName = "N/A";
        let companyLocation = { city: "N/A", state: "N/A" };
        let jobLocation = "N/A";
        let salaryFrom = "N/A";
        let salaryTo = "N/A";

        try {
          const businessAccount = await BusinessAccount.findById(employerId);

          if (businessAccount) {
            const companyId = businessAccount.companyId;
            const company = await companyModel.findById(companyId);

            if (company) {
              companyName = company.companyprofile.businessname;
              companyLocation = {
                city: company.companylocationdetails.city || "N/A",
                state: company.companylocationdetails.States || "N/A",
              };
            }
          }

          // Extract details from JobPost if adId is defined
          if (offerLetter.adId) {
            jobLocation = offerLetter.adId.location || "N/A";
            salaryFrom = offerLetter.adId.salaryFrom || "N/A";
            salaryTo = offerLetter.adId.salaryTo || "N/A";
          }
        } catch (err) {
          console.error(
            `Error fetching company details for employerId ${employerId}:`,
            err
          );
        }

        return {
          ...offerLetter.toObject(),
          companyName,
          companyLocation,
          jobLocation,
          salaryFrom,
          salaryTo,
          adId: offerLetter.adId ? offerLetter.adId._id : "N/A", // Check if adId is defined
        };
      })
    );

    res.status(200).json(offerLettersWithCompanyDetails);
  } catch (error) {
    console.error("Error fetching offer letters for employee:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// @desc    Get offer letters for an employer
// @route   GET /api/offer-letters/employer/:employerId
// @access  Private
const getOfferLettersForEmployer = asyncHandler(async (req, res) => {
  try {
    const employerId = req.employerId; // Extract employerId from request parameters

    console.log("Extracted employerId from request:", employerId);

    if (!employerId) {
      return res
        .status(400)
        .json({ message: "Employer ID is missing from the request" });
    }

    const offerLetters = await OfferLetter.find({ employerId }).populate(
      "adId"
    );

    console.log("Found offer letters:", offerLetters);

    if (!offerLetters.length) {
      return res
        .status(404)
        .json({ message: "No offer letters found for this employer" });
    }

    const offerLettersWithDetails = await Promise.all(
      offerLetters.map(async (offerLetter) => {
        const employeeId = offerLetter.employeeId;
        let companyName = "N/A";
        let companyLocation = { city: "N/A", state: "N/A" };
        let employeeName = "N/A";
        let facePhotoUri = "N/A";
        let jobLocation = "N/A";
        let salaryFrom = "N/A";
        let salaryTo = "N/A";

        try {
          // Fetch company details
          const businessAccount = await BusinessAccount.findById(employerId); // Updated to use findById for consistency
          if (businessAccount) {
            const companyId = businessAccount.companyId;
            const company = await companyModel.findById(companyId);

            if (company) {
              companyName = company.companyprofile.businessname || "N/A";
              companyLocation = {
                city: company.companylocationdetails?.city || "N/A",
                state: company.companylocationdetails?.States || "N/A", // Ensure consistent field name
              };
            }
          }

          // Fetch employee details
          const employeeInfo = await EmployeeInfoModel.findOne({
            id: employeeId,
          });

          if (employeeInfo) {
            employeeName = employeeInfo.personalInfo.name || "N/A";
            const facePhoto = employeeInfo.facePhoto;

            if (facePhoto && facePhoto.filename) {
              facePhotoUri = await generateV4ReadSignedUrl(
                String(employeeId),
                facePhoto.filename
              );
              console.log(
                `Generated signed URL for face photo: ${facePhotoUri}`
              );
            } else if (facePhoto && facePhoto.isCompleted) {
              console.log(
                `Face photo filename missing for userId: ${employeeId}`
              );
            }
          }

          // Extract details from JobPost
          if (offerLetter.adId) {
            jobLocation = offerLetter.adId.location || "N/A";
            salaryFrom = offerLetter.adId.salaryFrom || "N/A";
            salaryTo = offerLetter.adId.salaryTo || "N/A";
          }
        } catch (err) {
          console.error(
            `Error fetching details for employeeId ${employeeId} or employerId ${employerId}:`,
            err
          );
        }

        return {
          ...offerLetter.toObject(),
          companyName,
          companyLocation,
          employeeName,
          facePhotoUri,
          jobLocation,
          salaryFrom,
          salaryTo,
          adId: offerLetter.adId ? offerLetter.adId._id : "N/A", // Include adId in the response
        };
      })
    );

    res.status(200).json(offerLettersWithDetails);
  } catch (error) {
    console.error("Error fetching offer letters for employer:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// @desc    Get offer letter by ID
// @route   GET /api/offer-letters/:offerLetterId
// @access  Private
const getOfferLetterById = asyncHandler(async (req, res) => {
  try {
    const offerLetterId = req.params.offerLetterId;
    const offerLetter = await OfferLetter.findById(offerLetterId);

    if (!offerLetter) {
      console.error("Offer letter not found");
      return res.status(404).json({ message: "Offer letter not found" });
    }
    const employerId = offerLetter.employerId;
    const businessAccount = await BusinessAccount.findById(employerId);

    if (!businessAccount) {
      console.error("Employer not found");
      return res.status(404).json({ message: "Employer not found" });
    }

    const companyId = businessAccount.companyId;
    const company = await companyModel.findById(companyId);
    console.log("Fetched company:", company);

    if (!company) {
      console.error("Company not found");
      return res.status(404).json({ message: "Company not found" });
    }

    const companyName = company.companyprofile.businessname;
    const companyLocation = {
      city: company.companylocationdetails.city,
      state: company.companylocationdetails.States,
    };

    res.json({
      offerLetter,
      companyName,
      companyLocation,
    });
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// @desc    Update offer letter
// @route   PUT /api/offer-letters/:offerLetterId
// @access  Private
const updateOfferLetter = asyncHandler(async (req, res) => {
  try {
    const offerLetterId = req.params.offerLetterId;
    const {
      salary,
      joiningDate,
      workTimings,
      preferredWorkType,
      preferredSalaryType,
      weeklyOff,
      dailyWage,
      foodAllowanceType,
      foodAllowanceAmount,
      accomodationAllowance,
      otherAllowances,
    } = req.body;

    const offerLetter = await OfferLetter.findById(offerLetterId);

    if (!offerLetter) {
      res.status(404).json({ message: "Offer letter not found" });
    } else {
      offerLetter.salary = salary;
      offerLetter.dailyWage = dailyWage;
      offerLetter.joiningDate = joiningDate;
      offerLetter.workTimings = workTimings;
      offerLetter.preferredWorkType = preferredWorkType;
      offerLetter.preferredSalaryType = preferredSalaryType;
      offerLetter.weeklyOff = weeklyOff;
      offerLetter.foodAllowance = {
        type: foodAllowanceType,
        amount: foodAllowanceAmount,
      };
      offerLetter.accommodationAllowance = accomodationAllowance;
      offerLetter.otherAllowances = otherAllowances;

      const updatedOfferLetter = await offerLetter.save();
      res.json(updatedOfferLetter);
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Delete offer letter
// @route   DELETE /api/offer-letters/:offerLetterId
// @access  Private
const deleteOfferLetter = asyncHandler(async (req, res) => {
  try {
    const offerLetterId = req.params.offerLetterId;
    const deletedOfferLetter = await OfferLetter.findByIdAndDelete(
      offerLetterId
    );
    if (!deletedOfferLetter) {
      res.status(404).json({ message: "Offer letter not found" });
    } else {
      res.json({ message: "Offer letter deleted successfully" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Controller to accept or reject an offer letter
// Accept an offer letter
const acceptOfferLetter = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const offerLetter = await OfferLetter.findById(id);
    if (!offerLetter) {
      return res.status(404).json({ message: "Offer letter not found" });
    }

    // Check if the offer letter is already accepted
    if (offerLetter.status === "Accepted") {
      return res
        .status(400)
        .json({ message: "Offer letter has already been accepted" });
    }

    // Fetch the BusinessAccount to get the companyId and fcmToken
    const businessAccount = await BusinessAccount.findById(
      offerLetter.employerId
    );
    if (!businessAccount) {
      return res.status(404).json({ message: "Business account not found" });
    }

    const { companyId, fcmToken } = businessAccount;
    if (!companyId) {
      return res
        .status(400)
        .json({ message: "Company ID not found in BusinessAccount" });
    }

    offerLetter.status = "Accepted";
    await offerLetter.save();

    // Extract the employeeId and fetch employee details
    const { employeeId, jobTitle } = offerLetter;
    const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId });
    if (employeeInfo) {
      employeeInfo.workStatus = "already working";
      await employeeInfo.save();

      const employeeName = employeeInfo.personalInfo.name;

      // Send notification to the employer
      const title = `Offer letter accepted for ${jobTitle}`;
      const message = `${employeeName} has accepted the offer letter for the position of ${jobTitle}.`;

      await createNotification(
        employeeId,
        businessAccount._id,
        message,
        "company"
      ); // Log the notification
      await sendPushNotification(fcmToken, title, message); // Send push notification using FCM token
    }

    // Add EmployeeToCompanyMapping functionality
    let employeeToCompanyMapping = await EmployeeToCompanyMapping.findOne({
      companyId,
    });

    if (!employeeToCompanyMapping) {
      // If no mapping exists, create a new one
      employeeToCompanyMapping = new EmployeeToCompanyMapping({
        companyId,
        employees: [employeeId],
      });
    } else {
      // If a mapping exists, add the employeeId to the list of employees if not already present
      if (!employeeToCompanyMapping.employees.includes(employeeId)) {
        employeeToCompanyMapping.employees.push(employeeId);
      }
    }

    // Save the mapping
    await employeeToCompanyMapping.save();

    res
      .status(200)
      .json({ message: "Offer letter accepted successfully", offerLetter });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Reject an offer letter
const rejectOfferLetter = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const offerLetter = await OfferLetter.findById(id);
    if (!offerLetter) {
      return res.status(404).json({ message: "Offer letter not found" });
    }

    // Fetch the BusinessAccount to get the fcmToken
    const businessAccount = await BusinessAccount.findById(
      offerLetter.employerId
    );
    if (!businessAccount) {
      return res.status(404).json({ message: "Business account not found" });
    }

    const { fcmToken } = businessAccount;

    offerLetter.status = "Rejected";
    await offerLetter.save();

    // Extract employee details
    const { employeeId, jobTitle } = offerLetter;
    const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId });

    if (employeeInfo) {
      const employeeName = employeeInfo.personalInfo.name;

      // Send notification to the employer
      const title = `Offer letter rejected for ${jobTitle}`;
      const message = `${employeeName} has rejected the offer letter for the position of ${jobTitle}.`;

      await createNotification(
        employeeId,
        businessAccount._id,
        message,
        "company"
      ); // Log the notification
      await sendPushNotification(fcmToken, title, message); // Send push notification using FCM token
    }

    res
      .status(200)
      .json({ message: "Offer letter rejected successfully", offerLetter });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getAcceptedOfferLetters = asyncHandler(async (req, res) => {
  const employerId = req.employerId;

  try {
    const acceptedOfferLetters = await OfferLetter.find({
      employerId,
      status: "Accepted",
    });

    if (!acceptedOfferLetters.length) {
      return res
        .status(404)
        .json({ message: "No accepted offer letters found for this employer" });
    }

    res.status(200).json(acceptedOfferLetters);
  } catch (error) {
    console.error("Error fetching accepted offer letters:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Controller to list rejected offer letters based on employerId
const getRejectedOfferLetters = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  try {
    const rejectedOfferLetters = await OfferLetter.find({
      employerId,
      status: "Rejected",
    });

    if (!rejectedOfferLetters.length) {
      return res
        .status(404)
        .json({ message: "No rejected offer letters found for this employer" });
    }

    res.status(200).json(rejectedOfferLetters);
  } catch (error) {
    console.error("Error fetching rejected offer letters:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

const getAcceptedOfferLettersForEmployee = asyncHandler(async (req, res) => {
  try {
    const employeeId = req.employeeId; // Extract employeeId from the token
    const acceptedOfferLetters = await OfferLetter.find({
      employeeId,
      status: "Accepted",
    });

    if (!acceptedOfferLetters.length) {
      return res
        .status(404)
        .json({ message: "No accepted offer letters found for this employee" });
    }

    res.status(200).json(acceptedOfferLetters);
  } catch (error) {
    console.error("Error fetching accepted offer letters for employee:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Controller to list rejected offer letters for an employee
const getRejectedOfferLettersForEmployee = asyncHandler(async (req, res) => {
  try {
    const employeeId = req.employeeId; // Extract employeeId from the token
    const acceptedOfferLetters = await OfferLetter.find({
      employeeId,
      status: "Accepted",
    });

    if (!acceptedOfferLetters.length) {
      return res
        .status(404)
        .json({ message: "No accepted offer letters found for this employee" });
    }

    res.status(200).json(acceptedOfferLetters);
  } catch (error) {
    console.error("Error fetching accepted offer letters for employee:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getTodayEnd = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

const getWeekStart = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  const difference = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Assuming week starts on Monday
  const weekStart = new Date(today.setDate(today.getDate() - difference));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

const getWeekEnd = () => {
  const weekEnd = new Date(getWeekStart());
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

const getMonthStart = () => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
};

const getMonthEnd = () => {
  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0); // Last day of the previous month
  monthEnd.setHours(23, 59, 59, 999);
  return monthEnd;
};

// Controller to get metrics
const getOfferLetterMetrics = async (req, res) => {
  try {
    // Define date ranges
    const todayStart = getTodayStart();
    const todayEnd = getTodayEnd();
    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();
    const monthStart = getMonthStart();
    const monthEnd = getMonthEnd();

    const threeMonthsStart = new Date(monthStart);
    threeMonthsStart.setMonth(threeMonthsStart.getMonth() - 3);

    const sixMonthsStart = new Date(monthStart);
    sixMonthsStart.setMonth(sixMonthsStart.getMonth() - 6);

    const yearStart = new Date(monthStart);
    yearStart.setFullYear(yearStart.getFullYear() - 1);

    const previousThreeMonthsStart = new Date(threeMonthsStart);
    previousThreeMonthsStart.setMonth(previousThreeMonthsStart.getMonth() - 3);

    const previousSixMonthsStart = new Date(sixMonthsStart);
    previousSixMonthsStart.setMonth(previousSixMonthsStart.getMonth() - 6);

    const previousYearStart = new Date(yearStart);
    previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);

    // Count documents for each period
    const [
      totalOfferLetters,
      totalAccepted,
      totalRejected,
      createdToday,
      createdThisWeek,
      createdThisMonth,
      createdThreeMonths,
      createdSixMonths,
      createdThisYear,
      previousWeekCount,
      previousMonthCount,
      previousThreeMonthsCount,
      previousSixMonthsCount,
      previousYearCount,
    ] = await Promise.all([
      OfferLetter.countDocuments(),
      OfferLetter.countDocuments({ status: "Accepted" }),
      OfferLetter.countDocuments({ status: "Rejected" }),
      OfferLetter.countDocuments({
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: weekStart, $lte: weekEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: threeMonthsStart, $lte: monthEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: sixMonthsStart, $lte: monthEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: yearStart, $lte: monthEnd },
      }),
      OfferLetter.countDocuments({
        createdAt: {
          $gte: new Date(weekStart).setDate(weekStart.getDate() - 7),
          $lte: weekStart,
        },
      }),
      OfferLetter.countDocuments({
        createdAt: {
          $gte: new Date(monthStart).setMonth(monthStart.getMonth() - 1),
          $lte: monthStart,
        },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: previousThreeMonthsStart, $lte: threeMonthsStart },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: previousSixMonthsStart, $lte: sixMonthsStart },
      }),
      OfferLetter.countDocuments({
        createdAt: { $gte: previousYearStart, $lte: yearStart },
      }),
    ]);

    // Growth factor calculations
    const calculateGrowth = (current, previous) =>
      previous > 0 ? ((current - previous) / previous) * 100 : 0;

    const weeklyGrowth = parseFloat(
      calculateGrowth(createdThisWeek, previousWeekCount).toFixed(2)
    );
    const monthlyGrowth = parseFloat(
      calculateGrowth(createdThisMonth, previousMonthCount).toFixed(2)
    );
    const threeMonthsGrowth = parseFloat(
      calculateGrowth(createdThreeMonths, previousThreeMonthsCount).toFixed(2)
    );
    const sixMonthsGrowth = parseFloat(
      calculateGrowth(createdSixMonths, previousSixMonthsCount).toFixed(2)
    );
    const yearlyGrowth = parseFloat(
      calculateGrowth(createdThisYear, previousYearCount).toFixed(2)
    );

    // Send the response with the metrics
    res.status(200).json({
      totalOfferLetters,
      totalAccepted,
      totalRejected,
      createdToday,
      createdThisWeek,
      createdThisMonth,
      createdThreeMonths,
      createdSixMonths,
      createdThisYear,
      growth: {
        weeklyGrowth,
        monthlyGrowth,
        threeMonthsGrowth,
        sixMonthsGrowth,
        yearlyGrowth,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error retrieving metrics", error: err.message });
  }
};

const generateOfferLetter = async ({
  logoPath,
  recipient,
  startDate,
  jobDetails,
  companyName,
  res,
}) => {
  const doc = new PDFDocument({ margin: 50 });

  doc.pipe(res);

  doc
    .lineWidth(1)
    .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
    .stroke();

  // Handle logo as URL or file path
  if (logoPath) {
    try {
      if (logoPath.startsWith("http")) {
        const response = await axios.get(logoPath, {
          responseType: "arraybuffer",
        });
        const logoBuffer = Buffer.from(response.data, "binary");
        doc.image(logoBuffer, 50, 50, { width: 50 });
      } else {
        doc.image(logoPath, 50, 50, { width: 50 });
      }
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  }

  doc
    .fillColor("#000000")
    .fontSize(16)
    .text("kaamhai", 110, 65, { align: "left" });

  doc
    .fontSize(12)
    .fillColor("#666666")
    .text("www.kaamhai.in", doc.page.width - 150, 65, { align: "right" });

  doc
    .strokeColor("#000000")
    .fontSize(16)
    .text("kaamhai", 110, 65, { align: "left" });

  doc
    .fontSize(12)
    .fillColor("#666666")
    .text("www.kaamhai.in", doc.page.width - 150, 65, { align: "right" });

  doc
    .strokeColor("#000000")
    .lineWidth(1)
    .moveTo(50, 100)
    .lineTo(doc.page.width - 50, 100)
    .stroke();

  doc.rect(50, 120, 200, 80).fillColor("#f8f9fa").fill();

  doc
    .fillColor("#333333")
    .fontSize(12)
    .text(`To:`, 50, 120)
    .text(recipient.name, 70, 140)
    .text(recipient.phoneNumber, 70, 160)
    .text(recipient.state, 70, 180);

  doc.text(`Date: ${startDate}`, doc.page.width - 150, 120, { align: "right" });

  const bodyText = `Dear ${recipient.name},
We are delighted to extend an offer of employment to you for the position of ${jobDetails.jobTitle} at ${companyName}, facilitated through the Kaamhai platform. We are confident that your skills and experience will contribute significantly to our team and organizational goals.
Employment Details:
Position Title: ${jobDetails.jobTitle}
Start Date: ${startDate}
Work Location: ${jobDetails.jobLocation}
Compensation:
Your monthly compensation package will be Rs ${jobDetails.grossSalary}, inclusive of all applicable allowances and benefits. Detailed information about your salary structure is enclosed in Annexure I.
Working Hours:
Standard working hours are ${jobDetails.workTimings}.
Warm regards,
${companyName}`;

  doc
    .rect(50, 220, doc.page.width - 100, doc.page.height - 300)
    .fillColor("#ffffff")
    .fill();

  doc.fillColor("#333333").fontSize(11).text(bodyText, 50, 220, {
    align: "left",
    lineGap: 5,
    paragraphGap: 10,
  });

  doc
    .fontSize(8)
    .fillColor("#666666")
    .text(`Generated via Kaamhai | www.kaamhai.in`, 50, doc.page.height - 100, {
      align: "center",
    });

  doc.end();
};

export {
  getEmployeesByCompany,
  createOfferLetter,
  delinkCompanyAndEmployee,
  getOfferLettersForEmployee,
  getOfferLettersForEmployer,
  getOfferLetterById,
  updateOfferLetter,
  deleteOfferLetter,
  acceptOfferLetter,
  rejectOfferLetter,
  getAcceptedOfferLetters,
  getRejectedOfferLetters,
  getAcceptedOfferLettersForEmployee,
  getRejectedOfferLettersForEmployee,
  getOfferLetterMetrics,
  generateOfferLetter,
};
