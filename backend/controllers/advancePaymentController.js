import asyncHandler from '../handlers/asyncHandler.js';
import PaymentRequest from '../models/advancePaymentRequests.model.js';
import EmployeeToCompanyMapping from '../models/EmployeeToCompanyMapping.models.js';
import offerLetterModel from '../models/offerLetter.model.js';
import BusinessAccount from '../models/business/businessAccount.model.js';
import EmployeeInfoModel from '../models/employee/EmployeeInfo.model.js';
import Company from '../models/company.model.js';
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import ArchivePaymentRequest from "../models/advancePaymentRequestsArchive.model.js";
import Notification from '../models/notification.model.js';
import { sendNotification,createNotification, sendPushNotification } from '../utils/notificationUtils.js';

const createPaymentRequest = asyncHandler(async (req, res) => {
    try {
        const { amount, reason, employeeId: employeeIdFromBody } = req.body;
        const employeeId = req.role === 'admin' && employeeIdFromBody ? employeeIdFromBody : req.employeeId;

        if (!employeeId) {
            return res.status(400).json({ message: "Missing employee ID" });
        }

        const employeeToCompany = await EmployeeToCompanyMapping.findOne({ employees: employeeId }).lean();
        if (!employeeToCompany) {
            return res.status(404).json({ message: 'Employee not found in any company' });
        }

        const companyId = employeeToCompany.companyId;
        const offerLetter = await offerLetterModel.findOne({ employeeId }).lean();
        if (!offerLetter) {
            return res.status(404).json({ message: 'Offer letter not found for the employee in the given company' });
        }

        const salary = offerLetter.salary;
        const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId }).lean();
        if (!employeeInfo) {
            return res.status(404).json({ message: 'Employee info not found' });
        }

        const employeeName = employeeInfo.personalInfo.name || 'Unknown Employee';

        const newPaymentRequest = new PaymentRequest({
            employeeId,
            companyId,
            amount,
            salary,
            availableBalance: salary,
            reason,
            status: 'pending'
        });

        await newPaymentRequest.save();

        const businessAccount = await BusinessAccount.findOne({ companyId }).lean();

        // Wrap notification sending in a try-catch block
        try {
            // Ensure employer FCM token is available
            if (!businessAccount || !businessAccount.fcmToken) {
                console.log('Employer not found or FCM token is missing');
                return res.status(404).json({ message: 'Employer not found or FCM token is missing' });
            }

            console.log(`Business account FCM token: ${businessAccount.fcmToken}`);

            // Send a notification to the employer using the business account's FCM token
            const messageBody = `${employeeName} has requested an advance payment of ₹${amount}`;
            // Call sendPushNotification with the employer's fcmToken instead of employeeId
            await sendPushNotification(businessAccount.fcmToken, 'Advance Payment Request', messageBody, { amount }, false); // Set dryRun to false

            // Save the notification to the Notification model
            const newNotification = new Notification({
                senderId: employeeId,
                receiverId: companyId,
                message: messageBody,
                receiverType: 'company',
            });
            await newNotification.save();
        } catch (notificationError) {
            console.error("Notification sending failed:", notificationError.message);
        }

        res.status(201).json({
            message: 'Payment request created successfully',
            data: newPaymentRequest
        });
    } catch (error) {
        console.error("Error creating payment request:", error);
        res.status(500).json({ message: "Server error. Please try again later.", error: error.message });
    }
});

const getEmployeePaymentRequests = asyncHandler(async (req, res) => {
    const employeeId = req.employeeId; // Extract employeeId from JWT token
console.log(employeeId);
    // Fetch all payment requests for the employee
    const paymentRequests = await PaymentRequest.find({ employeeId }).sort({ createdAt: -1 });

    if (!paymentRequests || paymentRequests.length === 0) {
        return res.status(404).json({ message: 'No payment requests found for this employee' });
    }

    // Fetch the employee information
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
    }

    // Fetch the company information for each payment request
    const companyNames = await Promise.all(paymentRequests.map(async (request) => {
        const company = await Company.findById(request.companyId);
        return company ? company.companyprofile.businessname : 'Unknown Company';
    }));

    // Construct the response with employee and company names
    const formattedRequests = paymentRequests.map((request, index) => ({
        _id: request._id,
        employeeName: employee.personalInfo.name,  // Employee name
        companyName: companyNames[index],          // Company name
        amount: request.amount,
        salary: request.salary,
        availableBalance: request.availableBalance,
        reason: request.reason,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
    }));

    res.status(200).json({
        message: 'Payment requests fetched successfully',
        data: formattedRequests
    });
});

const getCompanyPaymentRequests = asyncHandler(async (req, res) => {
    const employerId = req.employerId; // Extract employerId from JWT token
    
    // Fetch the BusinessAccount to get the companyId
    const businessAccount = await BusinessAccount.findOne({ _id: employerId }).lean();
    if (!businessAccount || !businessAccount.companyId) {
        return res.status(404).json({ message: 'Business account or company not found' });
    }

    const companyId = businessAccount.companyId;

    // Fetch all payment requests for the company
    const paymentRequests = await PaymentRequest.find({ companyId }).sort({ createdAt: -1 });

    if (!paymentRequests || paymentRequests.length === 0) {
        return res.status(404).json({ message: 'No payment requests found for this company' });
    }

    // Fetch the company information
    const company = await Company.findById(companyId);
    if (!company) {
        return res.status(404).json({ message: 'Company not found' });
    }

    // Fetch the employee information and face photo for each payment request
    const employeeData = await Promise.all(paymentRequests.map(async (request) => {
        const employee = await EmployeeInfoModel.findOne({ id: request.employeeId });

        // Convert employeeId to string and fetch face photo
        const employeeIdStr = request.employeeId.toString();
        const facePhoto = employee && employee.facePhoto && employee.facePhoto.isCompleted
            ? await generateV4ReadSignedUrl(employeeIdStr, employee.facePhoto.filename)
            : null;
            return {
                name: employee ? employee.personalInfo.name : 'Unknown Employee',
                facePhotoUri: facePhoto // Include the face photo URI if available
            };
        }));
    
        // Calculate total number of requests and number of approved and rejected requests
        const totalRequests = paymentRequests.length;
        const approvedRequests = paymentRequests.filter(request => request.status === 'approved').length;
        const rejectedRequests = paymentRequests.filter(request => request.status === 'rejected').length;
    
        // Construct the response with employee and company names, and employee face photo
        const formattedRequests = paymentRequests.map((request, index) => ({
            _id: request._id,
            employeeName: employeeData[index].name,        // Employee name
            facePhotoUri: employeeData[index].facePhotoUri, // Employee face photo URI
            companyName: company.companyprofile.businessname,  // Company name
            amount: request.amount,
            salary: request.salary,
            availableBalance: request.availableBalance,
            reason: request.reason,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt
        }));
    
        res.status(200).json({
            message: 'Payment requests fetched successfully',
            totalRequests,
            approvedRequests,
            rejectedRequests,
            data: formattedRequests
        });
    });
    
const updatePaymentRequestStatus = asyncHandler(async (req, res) => {
    const { requestId } = req.params;  // Get the payment request ID from the URL
    const { status } = req.body;       // Get the status ("approved" or "rejected") from the request body

    // Ensure that the status is either 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Only "approved" or "rejected" are allowed.' });
    }

    // Find the payment request by ID
    const paymentRequest = await PaymentRequest.findById(requestId);
    if (!paymentRequest) {
        return res.status(404).json({ message: 'Payment request not found' });
    }

    // If the status is 'approved', ensure the available balance is sufficient
    if (status === 'approved') {
        if (paymentRequest.amount > paymentRequest.availableBalance) {
            return res.status(400).json({ message: 'Insufficient balance for this payment request.' });
        }
        paymentRequest.availableBalance -= paymentRequest.amount;
    }

    // Check if the user is an admin
    if (req.role === 'admin') {
        paymentRequest.admin = true;  // Set admin to true if the user is an admin
    }

    // Update the status of the payment request
    paymentRequest.status = status;
    await paymentRequest.save(); // Save the updated request

    // Notification title and message
    const notificationTitle = status === 'approved' ? 'Payment Request Approved' : 'Payment Request Rejected';
    const notificationMessage = `Your payment request has been ${status}.`;
    console.log(paymentRequest);
    console.log(req.employerId);
        console.log(paymentRequest.employeeId);
    // Create and save the notification for the user
    try {
            const employeeId = paymentRequest.employeeId;
            const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId }).lean();
            const fcmToken = employeeInfo.fcmToken;
            console.log("It's working");
        await createNotification(req.employerId, paymentRequest.employeeId, notificationMessage, 'employee'); // Assuming 'employee' as the receiver type
        console.log(paymentRequest);
        // Send the push notification to the user
        await sendPushNotification(fcmToken, notificationTitle, notificationMessage);
    } catch (notificationError) {
        console.error("Notification sending failed:", notificationError.message);
        // Log the error but continue processing the response
    }

    res.status(200).json({
        message: `Payment request ${status} successfully by ${req.role === 'admin' ? 'admin' : 'user'}`,
        data: paymentRequest,
        notificationSent: true
    });
});

const getAdvancePaymentMetrics = async (req, res) => {
    try {
        const { role } = req.query; // Admin role to differentiate between employee and employer perspectives

        // Total advance payment requests
        const totalAdvanceRequests = await PaymentRequest.countDocuments();

        // Advance requests by status
        const advanceRequestsByStatus = await PaymentRequest.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        // Total amount requested as advance
        const totalAdvanceAmount = await PaymentRequest.aggregate([
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
        ]);

        // Total available balance across all requests
        const totalAvailableBalance = await PaymentRequest.aggregate([
            { $group: { _id: null, totalBalance: { $sum: "$availableBalance" } } }
        ]);

        let additionalMetrics = {};
        if (role === 'employee_admin') {
            // Employee Management Perspective (Admin/HR POV)

            // Employees with the most advance payment requests
            const employeesWithMostAdvanceRequests = await PaymentRequest.aggregate([
                { $group: { _id: "$employeeId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }  // Top 5 employees with the most requests
            ]);

            additionalMetrics = {
                employeesWithMostAdvanceRequests,
                // Other employee-based metrics can be added here
            };
        } else if (role === 'employer_admin') {
            // Employer Management Perspective (Admin POV)

            // Advance payment requests per company
            const advanceRequestsPerCompany = await PaymentRequest.aggregate([
                { $group: { _id: "$companyId", count: { $sum: 1 } } }
            ]);

            // Total amount requested as advance per company
            const totalAdvanceAmountPerCompany = await PaymentRequest.aggregate([
                { $group: { _id: "$companyId", totalAmount: { $sum: "$amount" } } }
            ]);

            // Total salary tied to advance payments per company
            const totalSalaryPerCompany = await PaymentRequest.aggregate([
                { $group: { _id: "$companyId", totalSalary: { $sum: "$salary" } } }
            ]);

            additionalMetrics = {
                advanceRequestsPerCompany,
                totalAdvanceAmountPerCompany,
                totalSalaryPerCompany,
                // Other company-based metrics can be added here
            };
        }

        // Combine general and role-specific metrics
        const metrics = {
            totalAdvanceRequests,
            advanceRequestsByStatus,
            totalAdvanceAmount,
            totalAvailableBalance,
            ...additionalMetrics
        };

        res.status(200).json(metrics);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving advance payment metrics', error: err.message });
    }
};


const getAllPaymentRequests = async (req, res) => {
    try {
      // Fetch all payment requests
      const paymentRequests = await PaymentRequest.find();
  
      // Manually fetch employee and company details for each payment request
      const detailedPaymentRequests = await Promise.all(
        paymentRequests.map(async (request) => {
          // Fetch employee information including name and face photo
          const employee = await EmployeeInfoModel.findOne({ id: request.employeeId}).select('personalInfo.name facePhoto email');
          // Fetch company information
          const company = await Company.findById(request.companyId).select('companyprofile.businessname');
  
          // Generate face photo signed URL if available and completed
          const employeeIdStr = request.employeeId.toString();
          const facePhoto = employee && employee.facePhoto && employee.facePhoto.isCompleted
            ? await generateV4ReadSignedUrl(employeeIdStr, employee.facePhoto.filename)
            : null;
  
          return {
            ...request._doc,
            employee: employee ? {
              name: employee.personalInfo.name,
              email: employee.email,
              facePhotoUri: facePhoto // Include face photo URI
            } : null,
            company: company ? {
              name: company.companyprofile.businessname // Fetch company's business name
            } : null,
          };
        })
      );
  
      res.status(200).json({
        success: true,
      count: detailedPaymentRequests.length,
      data: detailedPaymentRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const deletePaymentRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  // Check if the user is an admin
  if (req.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Only admins can perform this action.' });
  }

  // Find the payment request by ID
  const paymentRequest = await PaymentRequest.findById(requestId);

  if (!paymentRequest) {
    return res.status(404).json({ message: 'Payment request not found.' });
  }

  // Archive the payment request before deletion
  const archivePaymentRequest = new ArchivePaymentRequest({
    employeeId: paymentRequest.employeeId,
    companyId: paymentRequest.companyId,
    amount: paymentRequest.amount,
    salary: paymentRequest.salary,
    availableBalance: paymentRequest.availableBalance,
    reason: paymentRequest.reason,
    status: paymentRequest.status,
    admin: paymentRequest.admin,
    createdAt: paymentRequest.createdAt,  // Preserve original timestamps
    updatedAt: paymentRequest.updatedAt
  });

  // Save the archive record
  await archivePaymentRequest.save();

  // Delete the original payment request from PaymentRequest model
  await paymentRequest.deleteOne({ _id: requestId });

  // Send success response
  res.status(200).json({
    message: 'Payment request successfully archived and deleted.',
    archivedData: archivePaymentRequest
  });
});

export {
    createPaymentRequest,
    getEmployeePaymentRequests,
    getCompanyPaymentRequests,
    updatePaymentRequestStatus,
        getAllPaymentRequests,
        deletePaymentRequest,
        getAdvancePaymentMetrics
}