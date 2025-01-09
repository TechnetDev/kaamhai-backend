import axios from "axios";
import cron from "node-cron";
import admin from "../config/firebaseConfig.js";
import Notification from "../models/notification.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";

const firebaseUrl = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

async function getAccessToken() {
  const token = await admin.credential.applicationDefault().getAccessToken();
  return token.access_token;
}

// Send Notification Function
export const sendNotification = async (req, res) => {
  const { title, body, targetToken } = req.body;

  const message = {
    message: {
      token: targetToken,
      notification: {
        title,
        body,
      },
    },
  };

  try {
    const accessToken = await getAccessToken();
    const response = await axios.post(firebaseUrl, message, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Save notification to DB
    const newNotification = new Notification({
      title,
      body,
      targetToken,
      scheduledTime: new Date(),
    });
    await newNotification.save();

    res
      .status(200)
      .json({ message: "Notification sent and saved", data: response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Schedule Notification Function
export const scheduleNotification = async (req, res) => {
  const { title, body, targetToken, scheduleTime } = req.body;

  const cronSchedule = parseToCronFormat(scheduleTime);

  try {
    // Save the notification in the database
    const newNotification = new Notification({
      title,
      body,
      targetToken,
      scheduledTime: new Date(scheduleTime),
    });
    await newNotification.save();

    // Schedule the notification
    cron.schedule(cronSchedule, async () => {
      const message = {
        message: {
          token: targetToken,
          notification: {
            title,
            body,
          },
        },
      };

      try {
        const accessToken = await getAccessToken();
        await axios.post(firebaseUrl, message, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log("Scheduled notification sent successfully");
      } catch (error) {
        console.error("Error sending scheduled notification:", error.message);
      }
    });

    res.status(200).json({ message: "Notification scheduled and saved" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Utility to parse schedule time into cron format
function parseToCronFormat(scheduleTime) {
  const date = new Date(scheduleTime);
  return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${
    date.getMonth() + 1
  } *`;
}

// Employer notifications controller
export const getEmployerNotifications = async (req, res) => {
  try {
    const employerId = req.employerId;
    console.log("Employer ID:", employerId);

    // Find the business account for the employer
    const businessAccount = await BusinessAccount.findById(employerId).populate(
      "companyId"
    );
    console.log("Business account:", businessAccount);

    if (!businessAccount) {
      console.log("Business account not found for employer ID:", employerId);
      return res.status(404).json({
        success: false,
        message: "Business account not found",
      });
    }

    // Extract the company ID as a string
    const companyId = businessAccount.companyId._id.toString();
    console.log("Company ID (string):", companyId);

    // Fetch notifications for the company
    const notifications = await Notification.find({
      receiverId: companyId,
      receiverType: "company",
    });
    console.log("Notifications:", notifications);

    // Mark all notifications as read
    const updateResult = await Notification.updateMany(
      { receiverId: companyId, receiverType: "company", isRead: false },
      { $set: { isRead: true } }
    );
    console.log("Update result:", updateResult);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching employer notifications:", error);
    return res.status(500).json({
      success: false,
      message: `Error fetching employer notifications: ${error.message}`,
    });
  }
};

// Employee notifications controller
export const getEmployeeNotifications = async (req, res) => {
  try {
    const employeeId = req.employeeId;

    // Fetch notifications for the employee
    const notifications = await Notification.find({
      receiverId: employeeId,
      receiverType: "employee",
    });

    // Mark all notifications as read
    await Notification.updateMany(
      { receiverId: employeeId, receiverType: "employee", isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching employee notifications",
    });
  }
};

export const getUnreadEmployerNotifications = async (req, res) => {
  try {
    const employerId = req.employerId;
    console.log("Employer ID:", employerId); // Log employer ID

    // Find the business account for the employer
    const businessAccount = await BusinessAccount.findById(employerId).populate(
      "companyId"
    );
    console.log("Business account:", businessAccount); // Log business account details

    if (!businessAccount) {
      console.log("Business account not found for employer ID:", employerId); // Log not found case
      return res.status(404).json({
        success: false,
        message: "Business account not found",
      });
    }

    // Extract the company ID as a string
    const companyId = businessAccount.companyId._id.toString();
    console.log("Company ID (string):", companyId); // Log company ID

    // Fetch unread notifications for the company
    const unreadNotifications = await Notification.find({
      receiverId: companyId,
      receiverType: "company",
      isRead: false, // Fetch only unread notifications
    });
    console.log("Unread Notifications:", unreadNotifications); // Log unread notifications fetched

    return res.status(200).json({
      success: true,
      data: unreadNotifications,
    });
  } catch (error) {
    console.error("Error fetching unread employer notifications:", error); // Log error details
    return res.status(500).json({
      success: false,
      message: `Error fetching unread employer notifications: ${error.message}`, // Include specific error message
    });
  }
};

// Employee unread notifications controller
export const getUnreadEmployeeNotifications = async (req, res) => {
  try {
    const employeeId = req.employeeId;

    // Fetch unread notifications for the employee
    const unreadNotifications = await Notification.find({
      receiverId: employeeId,
      receiverType: "employee",
      isRead: false, // Fetch only unread notifications
    });

    return res.status(200).json({
      success: true,
      data: unreadNotifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching unread employee notifications",
    });
  }
};
