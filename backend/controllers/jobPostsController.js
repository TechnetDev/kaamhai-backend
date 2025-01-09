import asyncHandler from "../handlers/asyncHandler.js";
import JobPost from "../models/jobPosts/jobPosts.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import Company from "../models/company.model.js";
import saveJobPostsModel from "../models/jobPosts/saveJobPosts.model.js";
import jobPostApplicationsModel from "../models/jobPosts/jobPostApplications.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import {
  sendNotification,
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";
import Notification from "../models/notification.model.js";
// @desc    Get job posts for a specific company
// @route   GET /api/jobPosts/business/:companyId
// @access  Public
const getJobPostsForBusiness = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId;
  console.log("Company ID for Job Posts:", companyId);
  if (!companyId) {
    return res.status(400).json({ message: "Missing company ID" });
  }

  const jobPosts = await JobPost.find({ companyId });
  res.status(200).json(jobPosts);
});

// @desc    Get all job posts for employees
// @route   GET /api/jobPosts/employee
// @access  Public
const getJobPostsForEmployee = asyncHandler(async (req, res) => {
  const jobPosts = await JobPost.find();
  res.status(201).json(jobPosts);
});

const getPaginatedJobPostsForEmployee = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if no page query param
  const limit = parseInt(req.query.limit) || 20; // Default to 20 posts per page
  const skip = (page - 1) * limit; // Calculate the number of posts to skip

  const jobPosts = await JobPost.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Return job posts directly without array or pagination metadata
  res.status(200).json(jobPosts);
});

// @desc    Create a new job post
// @route   POST /api/jobPosts/create
// @access  Public
const createJobPost = asyncHandler(async (req, res) => {
  try {
    const {
      designation,
      salaryPeriod,
      positionType,
      salaryFrom,
      salaryTo,
      describe,
      requirements,
      foodAllowance,
      location,
      accomodationAllowance,
      requiredEmployees,
      employerId: employerIdFromBody, // Admin can optionally pass employerId
    } = req.body;

    const employerId =
      req.role === "admin" && employerIdFromBody
        ? employerIdFromBody
        : req.employerId;

    if (!employerId) {
      return res.status(400).json({ message: "Missing employer ID" });
    }

    const businessAccount = await BusinessAccount.findById(employerId);
    if (!businessAccount) {
      return res
        .status(404)
        .json({ message: "Business account not found for this employer" });
    }

    const companyId = businessAccount.companyId;
    if (!companyId) {
      return res
        .status(404)
        .json({ message: "Company ID not found in business account" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyName = company.companyprofile.businessname;

    // Create the job post
    const jobPost = await JobPost.create({
      designation,
      salaryPeriod,
      positionType,
      salaryFrom,
      salaryTo,
      describe,
      requirements,
      foodAllowance,
      location,
      accomodationAllowance,
      requiredEmployees,
      image: req.files?.image
        ? {
            name: req.files.image[0].filename,
            size: req.files.image[0].size,
            contentType: req.files.image[0].mimetype,
            uri: req.files.image[0].path,
          }
        : {},
      companyId,
      companyName,
      employerId,
    });

    // Send notification to all employees
    const employees = await EmployeeInfoModel.find().lean();
    for (const employee of employees) {
      try {
        if (employee.fcmToken) {
          const notificationTitle = `New Job Post by ${companyName}`;
          const notificationMessage = `A new job post for ${designation} has been created.`;

          // Send push notification
          await sendPushNotification(
            employee.fcmToken,
            notificationTitle,
            notificationMessage,
            {
              jobId: jobPost._id,
              companyId,
              employerId,
            }
          );

          // Save notification to the database
          await Notification.create({
            senderId: employerId,
            receiverId: employee.id,
            message: notificationMessage,
            receiverType: "employee",
          });
        } else {
          console.log(`FCM token not found for employee ID: ${employee.id}`);
        }
      } catch (error) {
        console.error(
          `Error sending notification to employee ID: ${employee.id}`,
          error
        );
      }
    }

    const formattedDate = jobPost.createdAt.toISOString().slice(0, 10);
    const responseData = {
      ...jobPost.toObject(),
      adId: jobPost._id,
      createdAt: formattedDate,
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.error("Error creating job post:", error);
    res
      .status(500)
      .json({
        message: "Server error. Please try again later.",
        error: error.message,
      });
  }
});

// @desc    Get a job post by ID
// @route   GET /api/jobPosts/:id
// @access  Protected
const getJobPostById = asyncHandler(async (req, res) => {
  const jobPost = await JobPost.findById(req.params.id);
  if (!jobPost) {
    res.status(404).json({ message: "Job post not found" });
    return;
  }
  console.log(jobPost);
  res.status(200).json(jobPost);
});

/* save job posts */

// @desc    Create a new saved job post
// @route   POST /api/job-posts/save/create
// @access  Public
const createSaveJobPost = asyncHandler(async (req, res) => {
  const {
    title,
    designation,
    salaryPeriod,
    positionType,
    salaryFrom,
    salaryTo,
    describe,
    requirements,
    foodAllowance,
    location,
    accomodationAllowance,
    requiredEmployees,
  } = req.body;

  const employerId = req.employerId;

  if (!employerId) {
    return res.status(400).json({ message: "Missing employer ID in JWT" });
  }

  const businessAccount = await BusinessAccount.findById(employerId);
  if (!businessAccount) {
    return res
      .status(404)
      .json({ message: "Business account not found for this employer" });
  }

  const companyId = businessAccount.companyId;
  if (!companyId) {
    return res
      .status(404)
      .json({ message: "Company ID not found in business account" });
  }

  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  const companyName = company.companyprofile.businessname;

  const saveJobPost = await saveJobPostsModel.create({
    title,
    designation,
    salaryPeriod,
    positionType,
    salaryFrom,
    salaryTo,
    describe,
    requirements,
    foodAllowance,
    location,
    accomodationAllowance,
    requiredEmployees,
    image: req.files?.image
      ? {
          name: req.files.image[0].filename,
          size: req.files.image[0].size,
          contentType: req.files.image[0].mimetype,
          uri: req.files.image[0].path,
        }
      : {},
    companyId,
    companyName,
    employerId,
  });

  const formattedDate = saveJobPost.createdAt.toISOString().slice(0, 10);

  const responseData = {
    ...saveJobPost.toObject(),
    adId: saveJobPost._id,
    createdAt: formattedDate,
  };

  res.status(201).json(responseData);
});
// @desc    Get a saved job post by ID
// @route   GET /api/job-posts/saved/:id
// @access  Protected
const getSaveJobPostById = asyncHandler(async (req, res) => {
  const saveJobPost = await saveJobPostsModel.findById(req.params.id);
  if (!saveJobPost) {
    res.status(404).json({ message: "Saved job post not found" });
    return;
  }
  res.status(200).json(saveJobPost);
});
// @desc    Get saved job posts for a specific company
// @route   GET /api/job-posts/business/savedJobs/:companyId
// @access  Public
const getSaveJobPostsForBusiness = asyncHandler(async (req, res) => {
  const employerId = req.employerId;
  if (!employerId) {
    return res.status(400).json({ message: "Missing employer ID in JWT" });
  }

  const saveJobPosts = await saveJobPostsModel.find({ employerId });
  res.status(201).json(saveJobPosts);
});

const closeJobPost = asyncHandler(async (req, res) => {
  const jobPostId = req.params.id;
  const { reason } = req.body;

  const jobPost = await JobPost.findById(jobPostId);
  if (!jobPost) {
    res.status(404).json({ message: "Job post not found" });
    return;
  }

  jobPost.status = "closed";
  jobPost.closingReason = reason;
  await jobPost.save();

  res.status(200).json({ message: "Job post closed successfully", jobPost });
});

const editJobPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const jobPost = await JobPost.findById(id);
  if (!jobPost) {
    res.status(404).json({ message: "Job post not found" });
    return;
  }

  Object.keys(updates).forEach((key) => {
    jobPost[key] = updates[key];
  });

  if (req.files?.image) {
    jobPost.image = {
      name: req.files.image[0].filename,
      size: req.files.image[0].size,
      contentType: req.files.image[0].mimetype,
      uri: req.files.image[0].path,
    };
  }

  await jobPost.save();
  res.status(200).json(jobPost);
});

const updateJobPostStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, closingReason } = req.body;

  if (status === "closed" && !closingReason) {
    return res
      .status(400)
      .json({ message: "Closing reason is required when status is closed" });
  }

  const jobPost = await JobPost.findById(id);
  if (!jobPost) {
    res.status(404).json({ message: "Job post not found" });
    return;
  }

  jobPost.status = status;
  if (status === "closed") {
    jobPost.closingReason = closingReason;
  } else {
    jobPost.closingReason = ""; // Set the closing reason to an empty string if the status is not closed
  }

  await jobPost.save();
  res.status(200).json(jobPost);
});

const generateRandomNumber = () => {
  return Math.floor(100 + Math.random() * 900); // Generates a number between 100 and 999
};

const updateFreeSubscription = asyncHandler(async (req, res) => {
  const { jobPostId } = req.params;

  try {
    const jobPost = await JobPost.findById(jobPostId);

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Generate paymentID in the format "KHE-XXX"
    const paymentID = `KHE-${generateRandomNumber()}`;

    jobPost.freeSubscription = {
      paymentID,
      paymentMethod: "coupon", // Hardcoded paymentMethod
      updatedAt: new Date(),
    };
    jobPost.isPaymentDone = true; // Set isPaymentDone to true
    await jobPost.save();

    res.status(201).json(jobPost.freeSubscription);
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

const getJobPostStatistics = asyncHandler(async (req, res, next) => {
  try {
    // Fetch all job posts
    const jobPosts = await JobPost.find();

    // Loop through each job post and gather the necessary statistics, including applications
    const jobPostDetails = await Promise.all(
      jobPosts.map(async (jobPost) => {
        const { _id: jobId, employerId, companyId } = jobPost;

        // Manually fetch the company name
        const company = await Company.findById(companyId).select(
          "companyprofile.businessname"
        );
        const companyName =
          company?.companyprofile?.businessname || "Unknown Company";

        // Manually fetch the employer's name using employerId
        const employer = await BusinessAccount.findById(employerId).select(
          "basicDetails.fullName"
        );
        const employerName =
          employer?.basicDetails?.fullName || "Unknown Employer";

        // Get total number of applicants for each job post
        const totalApplicants = await jobPostApplicationsModel.countDocuments({
          adId: jobId,
        });

        // Get all job applications for the current job post
        const jobApplications = await jobPostApplicationsModel
          .find({ adId: jobId })
          .select("employeeId status createdAt"); // Only selecting relevant fields from applications

        // Fetch the employee names for each application
        const applicationsWithEmployeeNames = await Promise.all(
          jobApplications.map(async (application) => {
            const employee = await EmployeeInfoModel.findOne({
              id: application.employeeId,
            }).select("personalInfo.name");
            const employeeName =
              employee?.personalInfo?.name || "Unknown Employee";

            return {
              ...application._doc,
              employeeName, // Add employee name to the application details
            };
          })
        );

        // Return everything from the jobPost model, plus additional fields including applications
        return {
          ...jobPost._doc, // Spread operator to include all jobPost model fields
          companyName,
          employerName,
          totalApplicants,
          jobApplications: applicationsWithEmployeeNames, // Include the list of applications with employee names
          createdAt: jobPost.createdAt, // Including the createdAt timestamp
        };
      })
    );

    // Send the job post details with statistics and applications as response
    res.status(200).json(jobPostDetails);
  } catch (error) {
    next(error);
  }
});

const getJobPostDetails = asyncHandler(async (req, res, next) => {
  try {
    const { jobPostId } = req.params;

    // Fetch the job post by ID
    const jobPost = await JobPost.findById(jobPostId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    const { employerId, companyId } = jobPost;

    // Fetch company details by companyId
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Manually fetch the employer's name using employerId
    const employer = await BusinessAccount.findById(employerId).select(
      "basicDetails.fullName"
    );
    const employerName = employer?.basicDetails?.fullName || "Unknown Employer";

    // Get total number of applicants for the job post
    const totalApplicants = await jobPostApplicationsModel.countDocuments({
      adId: jobPostId,
    });

    // Get all job applications for the current job post
    const jobApplications = await jobPostApplicationsModel
      .find({ adId: jobPostId })
      .select("employeeId status createdAt"); // Only selecting relevant fields from applications

    // Fetch the employee names for each application
    const applicationsWithEmployeeNames = await Promise.all(
      jobApplications.map(async (application) => {
        const employee = await EmployeeInfoModel.findOne({
          id: application.employeeId,
        }).select("personalInfo.name formattedId");
        const employeeName = employee?.personalInfo?.name || "Unknown Employee";
        const formattedId = employee?.formattedId || "Invalid formatted Id";
        return {
          ...application._doc,
          employeeName, // Add employee name to the application details
          formattedId,
        };
      })
    );

    // Return everything from the jobPost model, plus additional fields including applications and company details
    const response = {
      ...jobPost._doc, // Spread operator to include all jobPost model fields
      companyDetails: company, // Include all company details
      employerName, // Include employer name
      totalApplicants, // Total number of applicants
      jobApplications: applicationsWithEmployeeNames, // Include the list of applications with employee names
      createdAt: jobPost.createdAt, // Including the createdAt timestamp
    };

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

const deleteJobPost = async (req, res) => {
  try {
    const { id } = req.params;
    const jobPost = await JobPost.findByIdAndDelete(id);

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    res.status(200).json({ message: "Job post deleted successfully", jobPost });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const updateJobPost = async (req, res) => {
  const jobPostId = req.params.id;

  try {
    // Find the job post by its ID and update it with the request body
    const updatedJobPost = await JobPost.findByIdAndUpdate(
      jobPostId,
      { $set: req.body }, // Only updates the provided fields
      { new: true, runValidators: true } // Returns the updated document and runs schema validations
    );

    // Check if the job post was found
    if (!updatedJobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Respond with the updated job post
    res.status(200).json(updatedJobPost);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating job post", error: error.message });
  }
};

const getAdminMetrics = async (req, res) => {
  try {
    // Get the timeframe from the request query (e.g., "day", "week", "month", etc.)
    const { timeframe } = req.query;
    let dateRange = {};

    // Define the date range based on the timeframe
    const currentDate = new Date();
    switch (timeframe) {
      case "day":
        dateRange = {
          $gte: new Date(currentDate.setDate(currentDate.getDate() - 1)),
        };
        break;
      case "week":
        dateRange = {
          $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)),
        };
        break;
      case "month":
        dateRange = {
          $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)),
        };
        break;
      case "3months":
        dateRange = {
          $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 3)),
        };
        break;
      case "6months":
        dateRange = {
          $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 6)),
        };
        break;
      case "year":
        dateRange = {
          $gte: new Date(
            currentDate.setFullYear(currentDate.getFullYear() - 1)
          ),
        };
        break;
      default:
        dateRange = {}; // If no timeframe is specified, retrieve all data
    }

    // Query with the date range filter on createdAt
    const dateFilter = dateRange.$gte ? { createdAt: dateRange } : {};

    // Main metrics calculation
    const totalJobPosts = await JobPost.countDocuments(dateFilter);
    const jobPostsByStatus = await JobPost.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const jobPostsByCompany = await JobPost.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$companyName", count: { $sum: 1 } } },
    ]);
    const jobPostsWithPayments = await JobPost.countDocuments({
      ...dateFilter,
      isPaymentDone: true,
    });
    const jobPostsFreeSubscription = await JobPost.countDocuments({
      ...dateFilter,
      "freeSubscription.paymentID": { $exists: true },
    });
    const totalApplications = await jobPostApplicationsModel.countDocuments(
      dateFilter
    );
    const applicationsByStatus = await jobPostApplicationsModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const applicationsPerJobPost = await jobPostApplicationsModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$adId", count: { $sum: 1 } } },
    ]);
    const applicationsByCompany = await jobPostApplicationsModel.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "jobposts", // Match the collection name of JobPost
          localField: "adId",
          foreignField: "_id",
          as: "jobPostDetails",
        },
      },
      { $unwind: "$jobPostDetails" },
      {
        $match: { "jobPostDetails.createdAt": dateRange }, // Apply date filter to job posts as well
      },
      {
        $group: {
          _id: "$jobPostDetails.companyName",
          count: { $sum: 1 },
        },
      },
    ]);

    // Growth metrics calculation
    const setDateRange = (
      daysOffset = 0,
      monthsOffset = 0,
      yearsOffset = 0
    ) => {
      const currentDate = new Date();
      return {
        $gte: new Date(
          currentDate.getFullYear() - yearsOffset,
          currentDate.getMonth() - monthsOffset,
          currentDate.getDate() - daysOffset
        ),
      };
    };

    const timeframes = {
      day: { current: setDateRange(1), previous: setDateRange(2) },
      week: { current: setDateRange(7), previous: setDateRange(14) },
      month: { current: setDateRange(0, 1), previous: setDateRange(0, 2) },
      "3months": { current: setDateRange(0, 3), previous: setDateRange(0, 6) },
      "6months": { current: setDateRange(0, 6), previous: setDateRange(0, 12) },
      year: { current: setDateRange(0, 0, 1), previous: setDateRange(0, 0, 2) },
    };

    const growthMetrics = {};

    for (const [key, { current, previous }] of Object.entries(timeframes)) {
      const currentDateFilter = { createdAt: current };
      const previousDateFilter = { createdAt: previous };

      const currentTotalJobPosts = await JobPost.countDocuments(
        currentDateFilter
      );
      const currentTotalApplications =
        await jobPostApplicationsModel.countDocuments(currentDateFilter);
      const previousTotalJobPosts = await JobPost.countDocuments(
        previousDateFilter
      );
      const previousTotalApplications =
        await jobPostApplicationsModel.countDocuments(previousDateFilter);

      const jobPostsGrowth =
        previousTotalJobPosts > 0
          ? ((currentTotalJobPosts - previousTotalJobPosts) /
              previousTotalJobPosts) *
            100
          : 0;

      const applicationsGrowth =
        previousTotalApplications > 0
          ? ((currentTotalApplications - previousTotalApplications) /
              previousTotalApplications) *
            100
          : 0;

      growthMetrics[key] = {
        totalJobPosts: currentTotalJobPosts,
        jobPostsGrowth: jobPostsGrowth.toFixed(2),
        totalApplications: currentTotalApplications,
        applicationsGrowth: applicationsGrowth.toFixed(2),
      };
    }

    // Send the combined response
    res.status(200).json({
      originalMetrics: {
        totalJobPosts,
        jobPostsByStatus,
        jobPostsByCompany,
        jobPostsWithPayments,
        jobPostsFreeSubscription,
        totalApplications,
      },
      growthMetrics,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error retrieving metrics", error: err.message });
  }
};

export {
  getJobPostsForBusiness,
  getJobPostsForEmployee,
  createJobPost,
  getJobPostById,
  createSaveJobPost,
  getSaveJobPostById,
  getSaveJobPostsForBusiness,
  closeJobPost,
  editJobPost,
  updateJobPostStatus,
  updateFreeSubscription,
  getJobPostStatistics,
  deleteJobPost,
  getJobPostDetails,
  updateJobPost,
  getAdminMetrics,
  getPaginatedJobPostsForEmployee,
};
