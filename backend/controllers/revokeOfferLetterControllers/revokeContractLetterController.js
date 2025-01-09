import asyncHandler from "../../handlers/asyncHandler.js";
import RevokeContractLetter from '../../models/revokeOfferLetter/revokeContractLetter.model.js';
import EmployeeInfoModel from "../../models/employee/EmployeeInfo.model.js";
import mongoose from 'mongoose';
import offerLetterModel from "../../models/offerLetter.model.js";
import Request from "../../models/companyEmployeeRequest.model.js" // Replace with actual path
import EmployeeToCompanyMapping from '../../models/EmployeeToCompanyMapping.models.js';
import BusinessAccount from "../../models/business/businessAccount.model.js";
import Notification from "../../models/notification.model.js";
import { sendNotification,createNotification, sendPushNotification } from '../../utils/notificationUtils.js';
// POST: Create a new revoke contract letter
const createRevokeContractLetter = asyncHandler(async (req, res) => {
    const { noticePeriod, offerLetterId, reasons, additionalNote } = req.body;
    const employeeId = req.employeeId; // Extract employeeId from JWT token

    // Fetch employee information
    const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!employeeInfo) {
        return res.status(404).json({ message: 'Employee not found' });
    }

    // Fetch offer letter information
    const offerLetter = await offerLetterModel.findById(offerLetterId).lean();
    if (!offerLetter) {
        return res.status(404).json({ message: 'Offer letter not found' });
    }

    // Extract employerId from the offer letter
    const employerId = offerLetter.employerId;

    // Fetch the BusinessAccount to get the companyId and FCM token
    const businessAccount = await BusinessAccount.findOne({ _id: employerId }).lean();
    if (!businessAccount || !businessAccount.companyId) {
        return res.status(404).json({ message: 'Business account, company, or FCM token not found' });
    }

    const companyId = businessAccount.companyId;
    const fcmToken = businessAccount.fcmToken;

    // Extract necessary details
    const employeeName = employeeInfo.personalInfo.name;
    const employeeRole = offerLetter.jobTitle;
    const employeeJoiningDate = offerLetter.startDate;

    // Create the revoke contract letter
    const newRevokeContractLetter = new RevokeContractLetter({
        noticePeriod,
        offerLetterId,
        employeeId: employeeInfo.id,
        companyId,              // Use companyId derived from BusinessAccount
        employeeName,          // Fetched from EmployeeInfo
        employeeRole,          // Fetched from OfferLetter
        employeeJoiningDate,   // Fetched from OfferLetter
        reasons,
        additionalNote,
        status: 'Pending'      // Initial status
    });

    await newRevokeContractLetter.save();

    // Prepare the notification message
    const messageBody = `${employeeName} has requested to revoke the contract for the position of ${employeeRole}. Reason: ${reasons}`;

    // Send notification to the employer using the FCM token
    try {
        await sendNotification(fcmToken, 'Contract Revocation Request', messageBody, { noticePeriod });

        // Save the notification in the Notification model
        const newNotification = new Notification({
            senderId: employeeId,
            receiverId: companyId,
            message: messageBody,
            receiverType: 'company',
        });
        await newNotification.save();
    } catch (notificationError) {
        console.error("Notification sending failed:", notificationError.message);
        // Log the error but continue processing the response
    }

    res.status(201).json({
        message: 'Revoke contract letter created successfully',
        data: newRevokeContractLetter
    });
});


// GET: Retrieve all revoke contract letters by companyId
const getRevokeContractLettersByCompanyId = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    const employerId = req.employeeId;
    console.log(employerId)

    const revokeContractLetters = await RevokeContractLetter.find({ companyId })
        .populate('offerLetterId')
        .populate('employeeId')
        .exec();

    if (revokeContractLetters.length === 0) {
        return res.status(404).json({ message: 'No revoke contract letters found for this company' });
    }

    res.status(200).json({
        message: 'Revoke contract letters retrieved successfully',
        data: revokeContractLetters
    });
});

// PUT: Update the status of a revoke contract letter
const updateRevokeContractLetterStatus = asyncHandler(async (req, res) => {
    const { companyId, revokeContractLetterId, status } = req.params;
    const employerId = req.employerId;

    console.log(employerId);

    const validStatuses = ['Pending', 'Approved', 'Rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    // Find the revoke contract letter to get the employeeId
    const revokeContractLetter = await RevokeContractLetter.findOne({ _id: revokeContractLetterId, companyId });

    if (!revokeContractLetter) {
        return res.status(404).json({ message: 'Revoke contract letter not found' });
    }

    const { employeeId } = revokeContractLetter;
    console.log(employeeId);

    // Update the status of the revoke contract letter
    const updatedRevokeContractLetter = await RevokeContractLetter.findOneAndUpdate(
        { _id: revokeContractLetterId, companyId },
        { status },
        { new: true }
    );

    if (!updatedRevokeContractLetter) {
        return res.status(404).json({ message: 'Revoke contract letter not found' });
    }

    // Remove the employeeId from the Request model
    await Request.updateOne(
        { companyId },
        { $pull: { employees: { employeeId } } }
    );

    // Remove the employeeId from the EmployeeToCompanyMapping model
    await EmployeeToCompanyMapping.updateOne(
        { companyId },
        { $pull: { employees: employeeId } }
    );

    if (status === 'Approved') {
        // Reset the companyLinkRequestStatus and workStatus to their default values
        await EmployeeInfoModel.updateOne(
            { id: employeeId },
            {
                companyLinkRequestStatus: '',
                workStatus: 'open to work',
            }
        );

            await offerLetterModel.deleteOne({ _id: revokeContractLetter.offerLetterId });
    }

    // Fetch the employee information to get the FCM token and employee name
    const employeeInfo = await EmployeeInfoModel.findOne({ id: employeeId }).lean();
    if (!employeeInfo || !employeeInfo.fcmToken) {
        return res.status(404).json({ message: 'Employee not found or FCM token is missing' });
    }

    const fcmToken = employeeInfo.fcmToken;
    const employeeName = employeeInfo.personalInfo.name;

    // Prepare notification message based on the action performed
    let messageBody = '';
    if (status === 'Approved') {
        messageBody = `Your contract revocation request has been approved.`;
    } else if (status === 'Rejected') {
        messageBody = `Your contract revocation request has been rejected.`;
    }

    // Send the notification to the employee
    try {
        await sendNotification(fcmToken, 'Contract Revocation Update', messageBody);

        // Save the notification in the Notification model
        const newNotification = new Notification({
            senderId: employerId,
            receiverId: employeeId,
            message: messageBody,
            receiverType: 'employee',
        });
        await newNotification.save();
    } catch (notificationError) {
        console.error("Notification sending failed:", notificationError.message);
        // Log the error but continue processing the response
    }

    res.status(200).json({
        message: 'Revoke contract letter status updated successfully and employee removed',
        data: updatedRevokeContractLetter
    });
});

export {
    createRevokeContractLetter,
    getRevokeContractLettersByCompanyId,
    updateRevokeContractLetterStatus
};