import asyncHandler from "../handlers/asyncHandler.js";
import { generateToken } from "../utils/generateToken.js";
import EmployerAuthModel from "../models/business/employerAuth.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import EmployerWithdrawalRequest from "../models/withdrawalEmployerRequest.model.js";
import EmployerReferralModel from "../models/businessReferral.model.js";
import mongoose from "mongoose";
import JobPost from "../models/jobPosts/jobPosts.model.js";
// @desc    Authenticate business & get token
// @route   POST /api/business/login
// @access  Public
const registerBusinessContact = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  const businessContact = await EmployerAuth.findOne({ phoneNumber });

  if (businessContact) {
    res.status(400);
    throw new Error("Contact already exists");
  }
  const contact = await EmployerAuthModel.create({
    phoneNumber,
  });

  if (contact) {
    const token = generateToken(phoneNumber, "employer");

    res.json({
      _id: contact._id,
      phoneNumber: contact.phoneNumber,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid contact data");
  }
});

// @desc    Create a new business
// @route   POST /api/business/register
// @access  Protected
const createBusiness = asyncHandler(async (req, res) => {
  const { basicDetails, address } = req.body;

  try {
    const userId = req.employerId; // Extract employerId from the request

    // Check if userId already has a business account
    const existingBusiness = await BusinessAccount.findOne({
      "basicDetails.userId": userId,
    });
    if (existingBusiness) {
      req.session.businessAccountId = existingBusiness._id;
      return res.status(200).json({
        _id: existingBusiness._id,
        business: existingBusiness,
        message: "User already has a business account",
      });
    }

    const newBusiness = await BusinessAccount.create({
      basicDetails: {
        ...basicDetails,
        userId,
      },
      address,
      isCompleted: true,
    });

    // Set business account ID in session (if using sessions)
    req.session.businessAccountId = newBusiness._id;

    res.status(201).json({
      _id: newBusiness._id,
      business: newBusiness,
      message: "Business created successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create business", error: error.message });
  }
});

// @desc    Get list of businesses
// @route   GET /api/businesses
// @access  Public
const listOfBusinesses = asyncHandler(async (req, res) => {
  try {
    const businesses = await BusinessAccount.find(
      {},
      "companyId basicDetails.fullName -_id"
    );
    res.status(200).json(businesses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve businesses", error: error.message });
  }
});

const updateBusinessName = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  const { fullName } = req.body;

  try {
    const business = await BusinessAccount.findById(employerId);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    business.basicDetails.fullName = fullName;
    await business.save();

    res.status(200).json({
      _id: business._id,
      fullName: business.basicDetails.fullName,
      message: "Business name updated successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Failed to update business name",
        error: error.message,
      });
  }
});

const updateBusinessDetails = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  const { basicDetails, address } = req.body;

  try {
    const business = await BusinessAccount.findById(employerId);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Update basicDetails if provided
    if (basicDetails) {
      business.basicDetails = {
        ...business.basicDetails,
        ...basicDetails,
      };
    }

    // Update address if provided
    if (address) {
      business.address = {
        ...business.address,
        ...address,
      };
    }

    await business.save();

    res.status(200).json({
      _id: business._id,
      basicDetails: business.basicDetails,
      address: business.address,
      message: "Business details updated successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Failed to update business details",
        error: error.message,
      });
  }
});

const getReferralDetails = async (req, res) => {
  try {
    const employerId = req.employerId;

    // Convert employerId to ObjectId if necessary
    const ObjectId = mongoose.Types.ObjectId;
    const employerObjectId = new ObjectId(employerId);

    // Fetch business account data using the employerObjectId
    const businessAccountData = await BusinessAccount.findOne(
      { _id: employerObjectId },
      "_id totalEarned"
    );
    if (!businessAccountData) {
      return res.status(404).json({ message: "Business account not found" });
    }

    const businessAccountObjectId = businessAccountData._id;

    // Find the referrer using the business account's object ID
    const referralData = await EmployerReferralModel.findOne({
      referrerEmployerId: businessAccountObjectId,
    }).populate("referees");
    if (!referralData) {
      return res
        .status(404)
        .json({ message: "No referral data found for this employer ID" });
    }

    const totalLinkedEmployers = referralData.referees.length;

    // Calculate total number of withdrawal requests for the business account's object ID
    const withdrawalRequests = await EmployerWithdrawalRequest.find({
      employerId: businessAccountObjectId,
    }).countDocuments();

    // Initialize paidPending count
    let paidPending = 0;

    // Fetch detailed information of each referred business account
    const refereesDetails = await Promise.all(
      referralData.referees.map(async (referee) => {
        // Fetch the business account's details using _id
        const refereeInfo = await BusinessAccount.findOne(
          { _id: referee._id },
          "basicDetails.fullName basicDetails.phoneNumber createdAt _id"
        );
        if (!refereeInfo) {
          console.log(`Referee not found for ID: ${referee._id}`);
          return null;
        }

        // Check if the referee has any job posts
        const jobPosts = await JobPost.find({ employerId: refereeInfo._id });

        // If no job posts are found, count as pending payment
        if (jobPosts.length === 0) {
          paidPending += 1;
          console.log(
            `No job posts found for referee ID: ${refereeInfo._id}, indicating pending payment.`
          );
        }

        return {
          name: refereeInfo.basicDetails.fullName,
          phoneNumber: refereeInfo.basicDetails.phoneNumber,
          businessAccountCreatedAt: refereeInfo.createdAt,
          firstJobPostCreatedAt:
            jobPosts.length > 0 ? jobPosts[0].createdAt : null, // Get the creation date of the first job post, if any
        };
      })
    );

    res.json({
      totalLinkedEmployers: totalLinkedEmployers,
      totalWithdrawalRequests: withdrawalRequests,
      totalEarned: businessAccountData.totalEarned,
      refereesDetails: refereesDetails.filter((detail) => detail !== null),
      paidPending: paidPending, // Return the count of referees with no job posts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getEmployerTransactions = async (req, res) => {
  const employerId = req.employerId;
  console.log(employerId);
  try {
    // Find business account details
    const employer = await BusinessAccount.findById(employerId);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Get employer's name from basicDetails
    const employerName = employer.basicDetails.fullName;

    // Fetch totalEarned and wallet amounts
    const totalEarned = employer.totalEarned || 0;
    const walletAmount = employer.wallet || 0;

    // Find all withdrawal requests by this employer
    const withdrawals = await EmployerWithdrawalRequest.find({
      employerId: employer._id,
    }).sort({ createdAt: -1 }); // Sorted by date, most recent first

    // Format the response
    const transactions = withdrawals.map((withdrawal) => ({
      transactionId: withdrawal._id, // Include the transaction ID
      employerName,
      state: withdrawal.state,
      withdrawalAmount: withdrawal.withdrawalAmount,
      requestDate: withdrawal.createdAt.toISOString(),
    }));

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

const getBusinessReferralDetails = async (req, res) => {
  try {
    // Fetch all referral records from EmployerReferralModel
    const referrals = await EmployerReferralModel.find().populate(
      "referrerEmployerId referees"
    );

    const referralDetails = await Promise.all(
      referrals.map(async (referral) => {
        const referrer = await BusinessAccount.findById(
          referral.referrerEmployerId
        );

        const refereesDetails = await Promise.all(
          referral.referees.map(async (refereeId) => {
            const referee = await BusinessAccount.findById(refereeId);
            const firstJobPost = await JobPost.findOne({
              employerId: refereeId,
            }).sort({ createdAt: 1 }); // Find the earliest job post

            return {
              employeeId: referee._id,
              name: referee.basicDetails.fullName,
              phoneNumber: referee.basicDetails.phoneNumber,
              employeeCreatedAt: referee.createdAt,
              firstJobPostCreatedAt: firstJobPost
                ? firstJobPost.createdAt
                : null,
            };
          })
        );

        return {
          referrerId: referrer._id,
          referrerName: referrer.basicDetails.fullName,
          referrerPhoneNumber: referrer.basicDetails.phoneNumber,
          referrerCreatedAt: referrer.createdAt,
          totalEarned: referrer.totalEarned,
          refereesDetails,
        };
      })
    );

    res.status(200).json({
      referralDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEmployerWithdrawalRequests = async (req, res) => {
  try {
    // Fetch all withdrawal requests and populate employer details
    const withdrawalRequests = await EmployerWithdrawalRequest.find().populate(
      "employerId"
    );

    const requestsDetails = withdrawalRequests.map((request) => {
      const employer = request.employerId;

      return {
        requestId: request._id,
        employeeId: employer._id, // This is the employerId in this context
        employeeName: employer.basicDetails.fullName,
        totalEarned: employer.totalEarned,
        walletAmount: employer.wallet,
        withdrawalAmount: request.withdrawalAmount,
        state: request.state,
      };
    });

    res.status(200).json({
      requestsDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const BusinessFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.employerId;
    console.log(fcmToken);
    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    // Update or create the user's FCM token in the database
    const updateResult = await BusinessAccount.updateOne(
      { _id: userId },
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

const getBusinessAccountSignupsCounts = async (req, res) => {
  try {
    const currentDate = new Date();

    // Define date ranges for each timeframe
    const dayDate = new Date(currentDate);
    dayDate.setDate(dayDate.getDate() - 1);

    const monthDate = new Date(currentDate);
    monthDate.setMonth(monthDate.getMonth() - 1);

    const threeMonthsDate = new Date(currentDate);
    threeMonthsDate.setMonth(threeMonthsDate.getMonth() - 3);

    const sixMonthsDate = new Date(currentDate);
    sixMonthsDate.setMonth(sixMonthsDate.getMonth() - 6);

    const yearDate = new Date(currentDate);
    yearDate.setFullYear(yearDate.getFullYear() - 1);

    // Define dates for week-on-week and month-on-month comparisons
    const lastWeekDate = new Date(currentDate);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);

    const lastMonthDate = new Date(currentDate);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    // Count signups for each timeframe
    const [
      dayCount,
      monthCount,
      threeMonthsCount,
      sixMonthsCount,
      yearCount,
      lastWeekCount,
      lastMonthCount,
    ] = await Promise.all([
      BusinessAccount.countDocuments({ createdAt: { $gte: dayDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: monthDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: threeMonthsDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: sixMonthsDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: yearDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: lastWeekDate } }),
      BusinessAccount.countDocuments({ createdAt: { $gte: lastMonthDate } }),
    ]);

    // Calculate week-on-week and month-on-month growth
    const weekOnWeekGrowth =
      lastWeekCount > 0
        ? ((dayCount - lastWeekCount) / lastWeekCount) * 100
        : 0;
    const monthOnMonthGrowth =
      lastMonthCount > 0
        ? ((monthCount - lastMonthCount) / lastMonthCount) * 100
        : 0;

    // Send all counts and growth percentages in a single response
    res.status(200).json({
      dayCount,
      monthCount,
      threeMonthsCount,
      sixMonthsCount,
      yearCount,
      weekOnWeekGrowth,
      monthOnMonthGrowth,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error retrieving signups counts",
        error: error.message,
      });
  }
};

export {
  registerBusinessContact,
  createBusiness,
  listOfBusinesses,
  updateBusinessName,
  updateBusinessDetails,
  getEmployerTransactions,
  getReferralDetails,
  getEmployerWithdrawalRequests,
  getBusinessReferralDetails,
  BusinessFcmToken,
  getBusinessAccountSignupsCounts,
};
