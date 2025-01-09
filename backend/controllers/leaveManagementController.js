import asyncHandler from "../handlers/asyncHandler.js";
import Notification from "../models/notification.model.js";
import LeaveRequest from "../models/leaveRequests.model.js";
import EmployeeToCompanyMapping from "../models/EmployeeToCompanyMapping.models.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import offerLetterModel from "../models/offerLetter.model.js";
import Company from "../models/company.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import ArchiveLeaveRequest from "../models/leaveRequestsArchive.model.js";
import {
  sendNotification,
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";
// Controller to create a leave request

const createLeaveRequest = asyncHandler(async (req, res) => {
  try {
    const {
      reason,
      startDate,
      endDate,
      employeeId: employeeIdFromBody,
    } = req.body;

    // Determine employeeId based on the user's role
    const employeeId =
      req.role === "admin" && employeeIdFromBody
        ? employeeIdFromBody
        : req.employeeId;

    if (!employeeId) {
      return res.status(400).json({ message: "Missing employee ID" });
    }

    // Fetch the employee's company mapping
    const employeeToCompany = await EmployeeToCompanyMapping.findOne({
      employees: employeeId,
    }).lean();
    if (!employeeToCompany) {
      return res
        .status(404)
        .json({ message: "Employee not found in any company" });
    }

    const companyId = employeeToCompany.companyId;

    // Fetch the employee's offer letter to get totalLeavesAllowed
    const offerLetter = await offerLetterModel.findOne({ employeeId }).lean();
    if (!offerLetter) {
      return res
        .status(404)
        .json({ message: "Offer letter not found for this employee" });
    }

    // Fetch the employee's information to get the name
    const employeeInfo = await EmployeeInfoModel.findOne({
      id: employeeId,
    }).lean();
    if (!employeeInfo) {
      return res
        .status(404)
        .json({ message: "Employee information not found" });
    }
    const employeeName = employeeInfo.personalInfo.name;

    // Calculate total days of leave requested
    const totalDays =
      Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      ) + 1; // Include both start and end date

    // Create a new leave request without checking total leaves allowed
    const newLeaveRequest = new LeaveRequest({
      employeeId,
      companyId,
      reason,
      startDate,
      endDate,
      totalDays,
      status: "pending",
    });

    await newLeaveRequest.save();

    // Try to handle the notification logic
    try {
      // Fetch the business account of the employer
      const businessAccount = await BusinessAccount.findOne({
        companyId,
      }).lean();
      if (businessAccount && businessAccount.fcmToken) {
        const messageBody = `${employeeName} has applied for a leave request`;
        await sendNotification(
          businessAccount.fcmToken,
          "Leave Request",
          messageBody,
          { reason }
        );

        const newNotification = new Notification({
          senderId: employeeId,
          receiverId: companyId,
          message: messageBody,
          receiverType: "company",
          isRead: false,
        });
        await newNotification.save();
      }
    } catch (error) {
      console.error("Notification failed: ", error.message);
      // Do not throw an error, simply log and continue
    }

    res.status(201).json({
      message: "Leave request created successfully",
      data: newLeaveRequest,
    });
  } catch (error) {
    console.error("Error creating leave request:", error);
    res
      .status(500)
      .json({
        message: "Server error. Please try again later.",
        error: error.message,
      });
  }
});

const getLeaveRequestMetrics = async (req, res) => {
  try {
    const { role } = req.query; // Assume role is passed as a query parameter to differentiate admin types

    // Total leave requests
    const totalLeaveRequests = await LeaveRequest.countDocuments();

    // Leave requests by status
    const leaveRequestsByStatus = await LeaveRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Total leave days requested
    const totalLeaveDaysRequested = await LeaveRequest.aggregate([
      { $group: { _id: null, totalLeaveDays: { $sum: "$totalDays" } } },
    ]);

    // Total leaves allowed
    const totalLeavesAllowed = await LeaveRequest.aggregate([
      { $group: { _id: null, totalAllowed: { $sum: "$totalLeavesAllowed" } } },
    ]);

    let additionalMetrics = {};
    if (role === "employee_admin") {
      // Employee management (Admin/HR POV)

      // Employees with the most leave requests
      const employeesWithMostLeaves = await LeaveRequest.aggregate([
        { $group: { _id: "$employeeId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }, // Get top 5 employees with most leave requests
      ]);

      additionalMetrics = {
        employeesWithMostLeaves,
        // Other employee-based metrics can be added here
      };
    } else if (role === "employer_admin") {
      // Employer management (Admin POV)

      // Leave requests per company
      const leaveRequestsPerCompany = await LeaveRequest.aggregate([
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]);

      // Total leave days requested per company
      const totalLeaveDaysPerCompany = await LeaveRequest.aggregate([
        {
          $group: { _id: "$companyId", totalLeaveDays: { $sum: "$totalDays" } },
        },
      ]);

      additionalMetrics = {
        leaveRequestsPerCompany,
        totalLeaveDaysPerCompany,
        // Other company-based metrics can be added here
      };
    }

    // Combine basic metrics and role-specific metrics
    const metrics = {
      totalLeaveRequests,
      leaveRequestsByStatus,
      totalLeaveDaysRequested,
      totalLeavesAllowed,
      ...additionalMetrics,
    };

    res.status(200).json(metrics);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error retrieving leave request metrics",
        error: err.message,
      });
  }
};

const getEmployeeLeaveRequests = asyncHandler(async (req, res) => {
  const employeeId = req.employeeId; // Extract employeeId from JWT token

  // Get the current year and month
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based index (January is 0, December is 11)

  // Find all leave requests for the employee
  const leaveRequests = await LeaveRequest.find({ employeeId }).sort({
    createdAt: -1,
  });

  if (!leaveRequests || leaveRequests.length === 0) {
    return res
      .status(404)
      .json({ message: "No leave requests found for this employee" });
  }

  // Fetch the employee information
  const employee = await EmployeeInfoModel.findOne({ id: employeeId });
  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  // Calculate the total number of approved leaves in the current month
  const totalLeavesCurrentMonth = leaveRequests.reduce((total, request) => {
    if (request.status === "approved") {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);

      // Check if the leave is within the current month and year
      if (
        startDate.getFullYear() === currentYear &&
        startDate.getMonth() === currentMonth
      ) {
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth =
          Math.ceil(
            (Math.min(endDate, endOfMonth) - startDate) / (1000 * 60 * 60 * 24)
          ) + 1;
        total += daysInMonth;
      } else if (
        endDate.getFullYear() === currentYear &&
        endDate.getMonth() === currentMonth
      ) {
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const daysInMonth =
          Math.ceil(
            (endDate - Math.max(startOfMonth, startDate)) /
              (1000 * 60 * 60 * 24)
          ) + 1;
        total += daysInMonth;
      } else if (
        startDate.getFullYear() === currentYear &&
        endDate.getFullYear() === currentYear &&
        startDate.getMonth() <= currentMonth &&
        endDate.getMonth() >= currentMonth
      ) {
        const daysInMonth =
          Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        total += daysInMonth;
      }
    }
    return total;
  }, 0);

  // Get total allowed leaves from the first leave request
  const totalLeavesAllowed = leaveRequests[0]?.totalLeavesAllowed || 0;

  // Construct the response
  const formattedRequests = leaveRequests.map((request) => ({
    _id: request._id,
    employeeName: employee.personalInfo.name, // Employee name
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }));

  res.status(200).json({
    message: "Leave requests fetched successfully",
    data: formattedRequests,
    totalLeavesAllowed,
    totalLeavesCurrentMonth, // Total approved leaves in the current month
  });
});

const getCompanyLeaveRequests = asyncHandler(async (req, res) => {
  const employerId = req.employerId; // Extract employerId from request (provided in token)

  // Fetch the BusinessAccount to get the companyId
  const businessAccount = await BusinessAccount.findOne({
    _id: employerId,
  }).lean();
  if (!businessAccount || !businessAccount.companyId) {
    return res
      .status(404)
      .json({ message: "Business account or company not found" });
  }

  const companyId = businessAccount.companyId;

  // Fetch all leave requests for the company
  const leaveRequests = await LeaveRequest.find({ companyId }).sort({
    createdAt: -1,
  });

  if (!leaveRequests || leaveRequests.length === 0) {
    return res
      .status(404)
      .json({ message: "No leave requests found for this company" });
  }

  // Fetch company information
  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  // Fetch employee information, job title, total leaves allowed, and face photo for each leave request
  const employeeData = await Promise.all(
    leaveRequests.map(async (request) => {
      const employee = await EmployeeInfoModel.findOne({
        id: request.employeeId,
      });
      const offerLetter = await offerLetterModel.findOne({
        employeeId: request.employeeId,
        employerId,
      });
      // Convert employeeId to string
      const employeeIdStr = request.employeeId.toString();

      // Generate the signed URL for the face photo if it exists and is completed
      const facePhoto =
        employee && employee.facePhoto && employee.facePhoto.isCompleted
          ? await generateV4ReadSignedUrl(
              employeeIdStr,
              employee.facePhoto.filename
            )
          : null;

      return {
        name: employee ? employee.personalInfo.name : "Unknown Employee",
        jobTitle: offerLetter ? offerLetter.jobTitle : "Unknown Job Title",
        totalLeavesAllowed: request.totalLeavesAllowed || 0, // Include totalLeavesAllowed from the request
        facePhotoUri: facePhoto, // Include the face photo URI if available
      };
    })
  );

  // Calculate the total number of requests and number of approved and rejected requests
  const totalRequests = leaveRequests.length;
  const approvedRequests = leaveRequests.filter(
    (request) => request.status === "approved"
  ).length;
  const rejectedRequests = leaveRequests.filter(
    (request) => request.status === "rejected"
  ).length;

  // Format the response data
  const formattedRequests = leaveRequests.map((request, index) => ({
    _id: request._id,
    employeeName: employeeData[index].name,
    jobTitle: employeeData[index].jobTitle, // Job title from OfferLetter
    companyName: company.companyprofile.businessname, // Company name
    totalLeavesAllowed: employeeData[index].totalLeavesAllowed, // Total allowed leaves
    facePhotoUri: employeeData[index].facePhotoUri, // Face photo URI
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }));

  // Send the response
  res.status(200).json({
    message: "Leave requests fetched successfully",
    data: formattedRequests,
    totalRequests,
    approvedRequests,
    rejectedRequests,
  });
});
// Controller to approve or reject a leave request
const updateLeaveRequestStatus = asyncHandler(async (req, res) => {
  const { requestId } = req.params; // Get the leave request ID from the URL
  const { status, leaveType } = req.body; // Get the status and optional leaveType from the request body

  // Ensure that the status is either 'approved' or 'rejected'
  if (!["approved", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({
        message: 'Invalid status. Only "approved" or "rejected" are allowed.',
      });
  }

  // If leaveType is provided, ensure it is either 'paid' or 'unpaid'
  if (leaveType && !["paid", "unpaid"].includes(leaveType)) {
    return res
      .status(400)
      .json({
        message: 'Invalid leaveType. Only "paid" or "unpaid" are allowed.',
      });
  }

  // Find the leave request by ID
  const leaveRequest = await LeaveRequest.findById(requestId);

  if (!leaveRequest) {
    return res.status(404).json({ message: "Leave request not found" });
  }

  // Check if the user is an admin
  if (req.role === "admin") {
    leaveRequest.admin = true; // Set the admin field to true if the user is an admin
  }

  // Update the status of the leave request
  leaveRequest.status = status;

  // Update leaveType if provided
  if (leaveType) {
    leaveRequest.leaveType = leaveType;
  }

  await leaveRequest.save();

  // Message to be sent in the notification
  const message = `Your leave request has been ${status}.`;
  const title =
    status === "approved" ? "Leave Request Approved" : "Leave Request Rejected"; // Dynamic title based on status

  // Create and save the notification
  try {
    // Fetch employee information based on leaveRequest.employeeId
    const employee = await EmployeeInfoModel.findOne({
      id: leaveRequest.employeeId,
    }).lean();

    if (!employee || !employee.fcmToken) {
      console.error("Employee or FCM token not found");
      return; // Exit early if employee or token is missing
    }

    const fcmToken = employee.fcmToken; // Get the fcmToken from the employee

    // Create a notification for the employee
    await createNotification(
      req.employerId,
      leaveRequest.employeeId,
      message,
      "employee"
    );

    // Send the push notification using fcmToken
    await sendPushNotification(fcmToken, title, message); // Pass the fcmToken, title, and message
  } catch (error) {
    console.error("Notification or push notification failed: ", error.message);
    // Log the error but continue with the response
  }

  // Respond with a success message
  res.status(200).json({
    message: `Leave request has been ${status} by ${
      req.role === "admin" ? "admin" : "user"
    }`,
    data: leaveRequest,
  });
});

const getAllLeaveRequests = async (req, res) => {
  try {
    // Fetch all leave requests
    const leaveRequests = await LeaveRequest.find();

    // Manually fetch employee and company details for each leave request
    const detailedLeaveRequests = await Promise.all(
      leaveRequests.map(async (request) => {
        // Fetch employee information including name and face photo
        const employee = await EmployeeInfoModel.findOne({
          id: request.employeeId,
        }).select("personalInfo.name facePhoto email");
        // Fetch company information
        const company = await Company.findById(request.companyId).select(
          "companyprofile.businessname"
        );

        // Generate face photo signed URL if available and completed

        const employeeIdStr = request.employeeId.toString();
        const facePhoto =
          employee && employee.facePhoto && employee.facePhoto.isCompleted
            ? await generateV4ReadSignedUrl(
                employeeIdStr,
                employee.facePhoto.filename
              )
            : null;

        return {
          ...request._doc,
          employee: employee
            ? {
                name: employee.personalInfo.name,
                email: employee.email,
                facePhotoUri: facePhoto, // Include face photo URI
              }
            : null,
          company: company
            ? {
                name: company.companyprofile.businessname, // Fetch company's business name
              }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: detailedLeaveRequests.length,
      data: detailedLeaveRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteLeaveRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  // Check if the user is an admin
  if (req.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Access denied. Only admins can perform this action." });
  }

  // Find the leave request by ID
  const leaveRequest = await LeaveRequest.findById(requestId);

  if (!leaveRequest) {
    return res.status(404).json({ message: "Leave request not found." });
  }

  // Archive the leave request before deletion
  const archiveLeaveRequest = new ArchiveLeaveRequest({
    employeeId: leaveRequest.employeeId,
    companyId: leaveRequest.companyId,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    totalDays: leaveRequest.totalDays,
    totalLeavesAllowed: leaveRequest.totalLeavesAllowed,
    reason: leaveRequest.reason,
    status: leaveRequest.status,
    admin: leaveRequest.admin,
    createdAt: leaveRequest.createdAt, // Preserve original timestamps
    updatedAt: leaveRequest.updatedAt,
  });

  // Save the archive record
  await archiveLeaveRequest.save();

  // Delete the original leave request from LeaveRequest model
  await LeaveRequest.deleteOne({ _id: requestId });

  // Send success response
  res.status(200).json({
    message: "Leave request successfully archived and deleted.",
    archivedData: archiveLeaveRequest,
  });
});

export {
  createLeaveRequest,
  getEmployeeLeaveRequests,
  getCompanyLeaveRequests,
  updateLeaveRequestStatus,
  getAllLeaveRequests,
  deleteLeaveRequest,
  getLeaveRequestMetrics,
};
