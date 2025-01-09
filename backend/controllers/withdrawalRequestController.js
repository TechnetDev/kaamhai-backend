import WithdrawalRequest from '../models/withdrawalUserRequest.model.js'; // Adjust the import path as necessary
import EmployeeInfoModel from '../models/employee/EmployeeInfo.model.js'; // Adjust the import path as necessary
import BusinessAccount from '../models/business/businessAccount.model.js';
import EmployerWithdrawalRequest from '../models/withdrawalEmployerRequest.model.js';
import mongoose from 'mongoose';
export const createWithdrawalRequest = async (req, res) => {
  const {  withdrawalAmount } = req.body;
  const employeeId = req.employeeId;
        console.log(employeeId);
  try {
    // Check if employee exists and has sufficient funds
    const employee = await EmployeeInfoModel.findOne({ id: employeeId });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee.wallet < withdrawalAmount) {
      return res.status(400).json({ message: 'Insufficient funds in the wallet' });
    }

    // Create the withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      employeeId,
      withdrawalAmount,
    });

    await withdrawalRequest.save();

    return res.status(201).json({ message: 'Withdrawal request created successfully', withdrawalRequest });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const createBusinessWithdrawalRequest = async (req, res) => {
  const { withdrawalAmount } = req.body;
  const employerId = req.employerId;
  console.log("id: ", employerId);

  // Validate employerId
  if (!mongoose.Types.ObjectId.isValid(employerId)) {
    return res.status(400).json({ message: 'Invalid employer ID format' });
  }

  try {
    // Check if the employer exists and has sufficient funds
    const employer = await BusinessAccount.findById(employerId);

    if (!employer) {
      return res.status(404).json({ message: 'Employer not found' });
    }

    if (employer.wallet < withdrawalAmount) {
      return res.status(400).json({ message: 'Insufficient funds in the wallet' });
    }

    // Create the withdrawal request
    const withdrawalRequest = new EmployerWithdrawalRequest({
      employerId,
      withdrawalAmount,
    });

    await withdrawalRequest.save();

    return res.status(201).json({ message: 'Withdrawal request created successfully', withdrawalRequest });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const getWithdrawalRequests = async (req, res) => {
  try {
    // Fetch all withdrawal requests (raw data)
    const withdrawalRequests = await WithdrawalRequest.find({});
    console.log('Raw Requests:', withdrawalRequests);

    // Manually fetch the employee data by matching on the `id` field in EmployeeInfo
    const requestsWithEmployeeData = await Promise.all(
      withdrawalRequests.map(async (request) => {
        if (request.employeeId) {
          // Find employee based on `id` instead of `_id`
          const employeeInfo = await EmployeeInfoModel.findOne({ id: request.employeeId }).select('personalInfo wallet totalEarned id');

          if (employeeInfo) {
            return {
              requestId: request._id,  // Add requestId as the _id of the request
              employeeId: employeeInfo.id,  // Return the custom `id`
              employeeName: employeeInfo.personalInfo?.name || 'N/A',
              totalEarned: employeeInfo.totalEarned || 0,
              walletAmount: employeeInfo.wallet || 0,
              withdrawalAmount: request.withdrawalAmount,
              state: request.state,
            };
          } else {
            return {
              requestId: request._id,  // Add requestId as the _id of the request
              employeeId: 'N/A',
              employeeName: 'N/A',
              totalEarned: 'N/A',
              walletAmount: 'N/A',
              withdrawalAmount: request.withdrawalAmount,
              state: request.state,
            };
          }
        } else {
          return {
            requestId: request._id,  // Add requestId as the _id of the request
            employeeId: 'N/A',
            employeeName: 'N/A',
            totalEarned: 'N/A',
            walletAmount: 'N/A',
            withdrawalAmount: request.withdrawalAmount,
            state: request.state,
          };
        }
      })
    );

    // Send the response
    res.status(200).json(requestsWithEmployeeData);
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


export const updateWithdrawalRequestState = async (req, res) => {
  try {
    const { requestId } = req.params; // Extract request ID from URL params
    const { state } = req.body; // Extract new state from the request body

    // Validate the state
    if (!['approved', 'rejected'].includes(state)) {
      return res.status(400).json({ message: 'Invalid state. Allowed values: approved, rejected.' });
    }

    // Find the withdrawal request by ID and update the state and adminId (from req.adminId)
    const updatedRequest = await WithdrawalRequest.findByIdAndUpdate(
      requestId,
      { state, adminId: req.adminId }, // Use req.adminId here
      { new: true } // Return the updated document
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    res.status(200).json({
      message: 'Withdrawal request state updated successfully',
      updatedRequest
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateEmployerWithdrawalRequestState = async (req, res) => {
  try {
    const { requestId } = req.params; // Extract request ID from URL params
    const { state } = req.body; // Extract new state from the request body
    const adminId = req.adminId; // Use adminId from the request (set by middleware)

    // Validate the state
    if (!['approved', 'rejected'].includes(state)) {
      return res.status(400).json({ message: 'Invalid state. Allowed values: approved, rejected.' });
    }

    // Find the withdrawal request by ID and update the state and adminId
    const updatedRequest = await EmployerWithdrawalRequest.findByIdAndUpdate(
      requestId,
      { state, adminId },
      { new: true } // Return the updated document
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    // Optionally, update the wallet balance of the BusinessAccount if approved
    if (state === 'approved') {
      const businessAccount = await BusinessAccount.findById(updatedRequest.employerId);
      if (businessAccount) {
        businessAccount.wallet -= updatedRequest.withdrawalAmount;
        await businessAccount.save();
      }
    }

    res.status(200).json({
      message: 'Withdrawal request state updated successfully',
      updatedRequest
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};