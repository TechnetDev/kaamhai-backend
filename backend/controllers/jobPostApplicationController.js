import asyncHandler from "../handlers/asyncHandler.js";
import JobPostApplication from "../models/jobPosts/jobPostApplications.model.js";
import JobPost from "../models/jobPosts/jobPosts.model.js";
import EmployeeInfo from "../models/employee/EmployeeInfo.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import { sendNotification } from "../utils/notificationUtils.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import {
  createNotification,
  sendPushNotification,
} from "../utils/notificationUtils.js";
import Notification from "../models/notification.model.js";
// @desc    Apply for a job post
// @route   POST /api/jobPostApplications/apply
// @access  Private (Assuming authentication is required)
const applyForJobPost = asyncHandler(async (req, res) => {
  const { adId, candidateId } = req.body;
  let employeeId = req.employeeId; // For employees applying

  // If candidateId is provided, use that as employeeId (for admin applying on behalf of candidate)
  if (candidateId) {
    employeeId = candidateId;
  }

  // Check if employeeId is present
  if (!employeeId) {
    return res.status(400).json({ message: "Employee ID is required." });
  }

  // Check if the employee has already applied for this job post
  const existingApplication = await JobPostApplication.findOne({
    adId,
    employeeId,
  });
  if (existingApplication) {
    return res
      .status(400)
      .json({ message: "You have already applied for this job." });
  }

  // Check if this is the employee's first application
  const firstApplication = !(await JobPostApplication.exists({ employeeId }));
  console.log("Is this the first application? ", firstApplication);

  // Create a new application
  const jobPostApplication = await JobPostApplication.create({
    adId,
    employeeId,
  });

  // Fetch the job post details
  const jobPost = await JobPost.findById(adId);
  if (!jobPost) {
    return res.status(404).json({ message: "Job post not found" });
  }
  const { employerId, designation, companyId } = jobPost;

  // Try to handle the notification logic
  try {
    // Fetch the business account to get the fcmToken
    const businessAccount = await BusinessAccount.findOne({ companyId });
    if (businessAccount && businessAccount.fcmToken) {
      // Find the employee who applied for the job
      const employeeInfo = await EmployeeInfo.findOne({ id: employeeId });
      const employeeName = employeeInfo
        ? employeeInfo.personalInfo.name
        : "An employee";

      // Send a notification to the employer
      const messageBody = `${employeeName} has applied for the ${designation} position.`;
      await sendNotification(
        businessAccount.fcmToken,
        messageBody,
        "New Job Application"
      );

      // Save the notification to the Notification model
      const newNotification = new Notification({
        senderId: employeeId,
        receiverId: companyId,
        message: messageBody,
        receiverType: "company",
      });
      await newNotification.save();
    }
  } catch (error) {
    console.error("Notification failed: ", error.message);
    // Do not throw an error, simply log and continue
  }

  if (firstApplication) {
    // Get the referrer information (referralCode or phoneNumber)
    const employeeInfo = await EmployeeInfo.findOne({ id: employeeId });
    const referrerIdentifier = employeeInfo?.referredBy;
    console.log("Referred by: ", referrerIdentifier);

    if (referrerIdentifier) {
      // Find the referrer by referralCode (phone number in this case)
      const referrer = await EmployeeInfo.findOne({
        $or: [
          { referralCode: referrerIdentifier },
          { "personalInfo.phoneNumber": referrerIdentifier },
        ],
      });
      if (referrer) {
        // Increment both the wallet and totalEarned fields by Rs 30
        await EmployeeInfo.findByIdAndUpdate(
          referrer._id,
          { $inc: { wallet: 30, totalEarned: 30 } },
          { new: true }
        );
      }
    }
  }

  res.status(201).json(jobPostApplication);
});

const getApplicationsByEmployee = asyncHandler(async (req, res) => {
  const employeeId = req.employeeId;

  const applications = await JobPostApplication.find({ employeeId }).populate(
    "adId"
  );
  res.status(201).json(applications);
});

//filter out applications on the basis of their status
//filter out applications on the basis of their status
const getApplicationsForJobPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { status } = req.query;

  console.log("Received postId:", postId);
  console.log("Received status:", status);

  const query = { adId: postId };
  if (status) {
    query.status = status;
  }

  console.log("Constructed query:", query);

  try {
    // Fetch raw applications
    const rawApplications = await JobPostApplication.find(query);
    console.log("Raw applications:", rawApplications);

    // Fetch the jobPost to get isPaymentDone
    const jobPost = await JobPost.findById(postId);
    const isPaymentDone = jobPost.isPaymentDone;

    // Array to hold fully populated applications
    const populatedApplications = [];

    // Iterate through each raw application
    for (const rawApp of rawApplications) {
      // Extract employeeId from raw application
      const employeeId = rawApp.employeeId.toString(); // Convert ObjectId to string
      // Fetch EmployeeInfo using the employeeId
      const employeeInfo = await EmployeeInfo.findOne({ id: employeeId });

      if (!employeeInfo) {
        console.error(`EmployeeInfo not found for employeeId ${employeeId}`);
        continue;
      }

      // Extract relevant fields from employeeInfo
      const { name, dob, state } = employeeInfo.personalInfo;
      const { totalExperience, jobTitle } =
        employeeInfo.professionalPreferences;
      const age = new Date().getFullYear() - new Date(dob).getFullYear();
      const facePhoto = employeeInfo.facePhoto; // Extract facePhoto

      // Generate signed URL for facePhoto if it's completed
      let facePhotoUrl = null;
      if (facePhoto && facePhoto.isCompleted) {
        console.log(
          `Processing facePhoto for employeeId ${employeeId}:`,
          facePhoto
        );
        if (typeof facePhoto.filename === "string") {
          facePhotoUrl = await generateV4ReadSignedUrl(
            employeeId,
            facePhoto.filename
          );
        } else {
          console.error(
            `Invalid facePhoto filename for employeeId ${employeeId}:`,
            facePhoto.filename
          );
        }
      }

      // Add extracted information to the raw application
      const fullyPopulatedApp = {
        ...rawApp.toObject(), // Convert Mongoose document to plain JavaScript object
        employeeName: name,
        age: age,
        state: state,
        totalExperience: totalExperience,
        jobTitle: jobTitle.length > 0 ? jobTitle[0] : null,
        facePhoto: facePhotoUrl, // Include facePhoto URL in the populated application
      };

      // Push fully populated application to the array
      populatedApplications.push(fullyPopulatedApp);
    }

    // Structure the response to include isPaymentDone outside the applications array
    const response = {
      isPaymentDone,
      applications: populatedApplications,
    };

    console.log("Fully populated applications with isPaymentDone:", response);

    res.status(201).json(response);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { postId, applicantId, status } = req.params;

  // Validate status
  if (!status || !["shortlisted", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid request data" });
  }

  // Find the job post to ensure authorization and get the designation and companyName
  const jobPost = await JobPost.findById(postId);
  if (!jobPost) {
    return res
      .status(403)
      .json({ message: "Unauthorized to update application" });
  }

  const { designation, companyName } = jobPost;

  // Update the application status
  const application = await JobPostApplication.findOneAndUpdate(
    { adId: postId, employeeId: applicantId },
    { status },
    { new: true }
  );

  if (!application) {
    return res.status(404).json({ message: "Application not found" });
  }

  // Fetch the employee info to get their FCM token
  try {
    const employee = await EmployeeInfoModel.findOne({
      id: applicantId,
    }).lean();

    if (!employee || !employee.fcmToken) {
      console.error("Employee or FCM token not found");
      return res
        .status(404)
        .json({ message: "Employee not found or FCM token missing" });
    }

    const fcmToken = employee.fcmToken;

    // Define the notification message and title based on the status
    const notificationTitle = `Application ${
      status === "shortlisted" ? "Shortlisted" : "Rejected"
    } for ${designation}`;
    const notificationMessage = `${designation} application ${status} at ${companyName}.`;

    // Send a notification to the employee
    await createNotification(
      req.employerId,
      applicantId,
      notificationMessage,
      "employee"
    ); // Log the notification in the system
    await sendPushNotification(
      fcmToken,
      notificationTitle,
      notificationMessage
    ); // Send push notification using FCM token
  } catch (error) {
    console.error("Error sending notification: ", error.message);
    // Log the error but don't prevent the status update from being returned
  }

  // Return the updated application
  res(200).json(application);
});

const deleteJobApplication = asyncHandler(async (req, res) => {
  const { applicationId } = req.params; // Expecting the application ID in the URL parameters

  // Find and delete the application
  const deletedApplication = await JobPostApplication.findByIdAndDelete(
    applicationId
  );

  if (!deletedApplication) {
    return res.status(404).json({ message: "Job application not found" });
  }

  res.status(200).json({ message: "Job application deleted successfully" });
});

export {
  applyForJobPost,
  getApplicationsByEmployee,
  getApplicationsForJobPost,
  updateApplicationStatus,
  deleteJobApplication,
};
