import asyncHandler from "../handlers/asyncHandler.js";
import EmployeeInfo from "../models/employee/EmployeeInfo.model.js";
import JobPostApplication from "../models/jobPosts/jobPostApplications.model.js";
import OfferLetter from "../models/offerLetter.model.js";
import mongoose from 'mongoose';
import axios from 'axios';
// @desc    Update employee personal information
// @route   PUT /api/employee/:id/personalInfo
// @access  Admin
const updateEmployeeInfo = asyncHandler(async (req, res) => {
  const { formattedId } = req.params;
  const updateFields = req.body;

  if (!updateFields || Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: "At least one field is required to update" });
  }

  try {
    const employee = await EmployeeInfo.findOne({ formattedId });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Iterate over each field in the request body and update it in the employee document
    Object.keys(updateFields).forEach((field) => {
      if (typeof updateFields[field] === 'object' && !Array.isArray(updateFields[field])) {
        // For nested objects, merge the existing object with the new updates
        employee[field] = {
          ...employee[field].toObject(),
          ...updateFields[field],
        };
      } else {
        // For non-object fields (e.g., simple strings, numbers), directly update
        employee[field] = updateFields[field];
      }
    });

    const updatedEmployee = await employee.save();

    res.status(200).json({
      message: "Employee info updated successfully",
      updatedFields: updateFields,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({
      error: "An error occurred while updating employee info",
      details: error.message,
    });
  }
});

const getStats = asyncHandler(async (req, res, next) => {
  try {
    // Global stats calculation
    const totalCandidates = await EmployeeInfo.countDocuments();
    const totalApplications = await JobPostApplication.countDocuments();

    // Calculate average applications per candidate
    const averageApplicationsPerCandidate = totalCandidates ? (totalApplications / totalCandidates).toFixed(4) : 0;

    // Calculate counts and percentage split for application statuses
    const applicationStatusCounts = await JobPostApplication.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = applicationStatusCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, { shortlisted: 0, rejected: 0, 'under review': 0 });

    const totalStatusCount = statusCounts.shortlisted + statusCounts.rejected + statusCounts['under review'];

    const statusPercentages = {
      shortlistedPercentage: totalStatusCount ? ((statusCounts.shortlisted / totalStatusCount) * 100).toFixed(2) : 0,
      rejectedPercentage: totalStatusCount ? ((statusCounts.rejected / totalStatusCount) * 100).toFixed(2) : 0,
      underReviewPercentage: totalStatusCount ? ((statusCounts['under review'] / totalStatusCount) * 100).toFixed(2) : 0,
    };

    // Employee-specific details calculation
    const employees = await EmployeeInfo.find().select('personalInfo.name id'); // Fetch the associated ID

    const employeeDetails = await Promise.all(employees.map(async (employee) => {
      const { _id: employeeId, personalInfo: { name: candidateName }, id: associatedId } = employee;

      // Ensure associatedId is an ObjectId if it's stored as a string
      const empId = new mongoose.Types.ObjectId(associatedId);

      console.log(`Processing employee: ${candidateName} (${empId})`);

      // Fetch total number of applications for the employee
      const totalApplications = await JobPostApplication.countDocuments({ employeeId: empId });
      console.log(`Total Applications for ${candidateName}:`, totalApplications);

      // Fetch counts of application statuses
      const applicationStatusCounts = await JobPostApplication.aggregate([
        { $match: { employeeId: empId } },
        {
          $group: {
            _id: null,
            shortlistedCount: { $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] } },
            rejectedCountApps: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
            underReviewCount: { $sum: { $cond: [{ $eq: ["$status", "under review"] }, 1, 0] } }
          }
        }
      ]);
      console.log(`Application Status Counts for ${candidateName}:`, applicationStatusCounts);

      const { shortlistedCount = 0, rejectedCountApps = 0, underReviewCount = 0 } = applicationStatusCounts[0] || {};

      // Fetch total number of offer letters for the employee
      const totalOfferLetters = await OfferLetter.countDocuments({ employeeId: empId });
      console.log(`Total Offer Letters for ${candidateName}:`, totalOfferLetters);

      // Fetch counts of accepted and rejected offer letters
      const offerLetterStatusCounts = await OfferLetter.aggregate([
        { $match: { employeeId: empId } },
        {
          $group: {
            _id: null,
            acceptedCount: { $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] } },
            rejectedCount: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
            pendingCount: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } }
          }
        }
      ]);
      console.log(`Offer Letter Status Counts for ${candidateName}:`, offerLetterStatusCounts);

      const { acceptedCount = 0, rejectedCount = 0, pendingCount = 0 } = offerLetterStatusCounts[0] || {};

      // Return the aggregated data for each employee
      return {
        employeeId,
        candidateName,
        totalApplications,
        applications: {
          shortlisted: shortlistedCount,
          rejected: rejectedCountApps,
          underReview: underReviewCount
        },
        totalOfferLetters,
        offerLetters: {
          accepted: acceptedCount,
          rejected: rejectedCount,
          pending: pendingCount
        }
      };
    }));

    // Send the response with global and employee-specific stats
    res.status(200).json({
      globalStats: {
        totalCandidates,
        totalApplications,
        averageApplicationsPerCandidate,
        applicationStatusCounts: {
          shortlisted: statusCounts.shortlisted,
          rejected: statusCounts.rejected,
          underReview: statusCounts['under review']
        },
        applicationStatusPercentages: statusPercentages
      },
      employeeDetails
    });
  } catch (error) {
    console.error('Error occurred while fetching stats:', error);
    res.status(500);
    next(error);
  }
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Delay function

const fetchAllPayments = async (keyId, keySecret) => {
  const results = [];
  let skip = 0; // Initial skip value
  const count = 100; // Fetch 100 records per request (maximum allowed by the API)
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`Fetching payments, skipping ${skip} payments`);

      const response = await axios.get('https://api.razorpay.com/v1/payments', {
        auth: {
          username: keyId,
          password: keySecret,
        },
        params: {
          skip,  // Skip the previously fetched records
          count,  // Fetch 100 records per request
        },
      });

      const fetchedPayments = response.data.items;

      console.log(`Fetched ${fetchedPayments.length} payments`);

      if (fetchedPayments.length > 0) {
        results.push(...fetchedPayments);
        skip += fetchedPayments.length; // Update skip to avoid fetching the same records
      }

      // If fewer than the count records are returned, there are no more records left
      if (fetchedPayments.length < count) {
        hasMore = false;
      }
    }
  } catch (error) {
    if (error.response) {
      console.error(`Razorpay API responded with status: ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from Razorpay API:', error.request);
    } else {
      console.error('Error setting up the request:', error.message);
    }

    throw new Error('Failed to fetch Razorpay payments');
  }

  return results;
};

const getPayments = async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('Received request to fetch Razorpay payments');
  console.log('Using key ID:', keyId ? '[REDACTED]' : 'Not provided');

  if (!keyId || !keySecret) {
    console.error('Razorpay API keys are missing');
    return res.status(500).json({ error: 'Razorpay API keys are missing in environment variables' });
  }

  try {
    const payments = await fetchAllPayments(keyId, keySecret);

    console.log(`Successfully fetched ${payments.length} payments from Razorpay`);

    const formattedPayments = payments.map((payment) => ({
      description: payment.description,
      method: payment.method,
            id:payment.id,
      email: payment.email,
      contact: payment.contact,
      order_id: payment.order_id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      status: payment.status,
      type: payment.description === 'Subscription for Kaamhai' ? 'employee' : 'business',
    }));

    res.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching Razorpay payments:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get payments based on status
const filterPaymentsByStatus = (payments, status) => {
  return payments.filter(payment => payment.status === status);
};

// Helper function to get payments within a specific date range
const filterPaymentsByDateRange = (payments, startTimestamp, endTimestamp) => {
  return payments.filter(payment => {
    const paymentTimestamp = payment.created_at;
    return paymentTimestamp >= startTimestamp && paymentTimestamp <= endTimestamp;
  });
};

// Helper function to calculate the growth percentage
const calculateGrowthPercentage = (previousPeriodCount, currentPeriodCount) => {
  if (previousPeriodCount === 0) return 0;
  return ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100;
};

// Controller function to get payment stats and growth percentage
const getPaymentStats = async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('Received request to fetch Razorpay payment stats');
  console.log('Using key ID:', keyId ? '[REDACTED]' : 'Not provided');

  if (!keyId || !keySecret) {
    console.error('Razorpay API keys are missing');
    return res.status(500).json({ error: 'Razorpay API keys are missing in environment variables' });
  }

  try {
    const payments = await fetchAllPayments(keyId, keySecret);

    // Get the current date and other required date ranges
    const currentDate = new Date();
    const thisWeekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay())); // Start of this week
    const thisMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); // Start of this month
    const past3MonthsStart = new Date(currentDate.setMonth(currentDate.getMonth() - 3)); // 3 months ago
    const past6MonthsStart = new Date(currentDate.setMonth(currentDate.getMonth() - 6)); // 6 months ago

    const currentWeekPayments = filterPaymentsByDateRange(payments, thisWeekStart.getTime() / 1000, Date.now() / 1000);
    const currentMonthPayments = filterPaymentsByDateRange(payments, thisMonthStart.getTime() / 1000, Date.now() / 1000);
    const past3MonthsPayments = filterPaymentsByDateRange(payments, past3MonthsStart.getTime() / 1000, Date.now() / 1000);
    const past6MonthsPayments = filterPaymentsByDateRange(payments, past6MonthsStart.getTime() / 1000, Date.now() / 1000);

    // Get total count of payments with specific status
    const capturedPayments = filterPaymentsByStatus(payments, 'captured');
    const failedPayments = filterPaymentsByStatus(payments, 'failed');
    const attemptedPayments = filterPaymentsByStatus(payments, 'attempted');

    // Get count for different periods
    const totalCapturedCount = capturedPayments.length;
    const totalFailedCount = failedPayments.length;
    const totalAttemptedCount = attemptedPayments.length;

    const weekCount = currentWeekPayments.length;
    const monthCount = currentMonthPayments.length;
    const past3MonthsCount = past3MonthsPayments.length;
    const past6MonthsCount = past6MonthsPayments.length;

    // Calculate growth percentages
    const weekGrowth = calculateGrowthPercentage(past3MonthsCount, weekCount);
    const monthGrowth = calculateGrowthPercentage(past6MonthsCount, monthCount);
const past3MonthsGrowth = calculateGrowthPercentage(past6MonthsCount, past3MonthsCount); // 3-month growth
    const past6MonthsGrowth = calculateGrowthPercentage(0, past6MonthsCount);

    const stats = {
      totalCaptured: totalCapturedCount,
      totalFailed: totalFailedCount,
      totalAttempted: totalAttemptedCount,
      weekCount,
      monthCount,
      past3MonthsCount,
      past6MonthsCount,
      weekGrowth,
      monthGrowth,
            past3MonthsGrowth,
            past6MonthsGrowth
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching Razorpay payment stats:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export { updateEmployeeInfo,getStats, getPayments, getPaymentStats };