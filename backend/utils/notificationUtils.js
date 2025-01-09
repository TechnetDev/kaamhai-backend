import admin from "firebase-admin"; // Ensure Firebase Admin SDK is initialized
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import Notification from "../models/notification.model.js";
import mongoose from "mongoose";
// Function to send a push notification using Firebase Cloud Messaging
export const sendDocumentUploadNotification = async (fcmToken, messageBody) => {
  if (!fcmToken) {
    console.log("FCM token not available");
    return;
  }

  const message = {
    notification: {
      title: "Document Upload",
      body: messageBody,
    },
    token: fcmToken,
  };

  try {
    // Send the notification to the device with the provided FCM token
    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully:", response);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

/**
 * Sends a notification via Firebase Cloud Messaging (FCM)
 *
 * @param {string} fcmToken - The FCM token of the receiver
 * @param {string} title - The title of the notification
 * @param {string} message - The body/message of the notification
 * @param {object} data - Additional data to send along with the notification
 */
export const sendNotification = async (
  fcmToken,
  title,
  message,
  data = {},
  dryRun = false
) => {
  try {
    const notificationPayload = {
      notification: {
        title,
        body: message,
      },
      data: {
        ...data,
        icon: "ic_notification", // Custom icon
        sound: "notificationsound", // Custom sound
      },
      token: fcmToken,
    };

    // Define options for priority and content available
    const options = {
      priority: "high", // High priority for immediate delivery
      content_available: true, // Ensures notification is delivered even when app is in foreground
    };

    // Send the notification with options and dryRun flag
    const response = await admin
      .messaging()
      .send(notificationPayload, dryRun, options);

    if (dryRun) {
      console.log("Dry run successful:", response);
    } else {
      console.log("Notification sent successfully:", response);
    }
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
// Utility function to create a notification and save it to the database
export const createNotification = async (
  senderId,
  receiverId,
  message,
  receiverType
) => {
  const notification = new Notification({
    senderId,
    receiverId,
    message,
    receiverType,
  });
  await notification.save(); // Save the notification to the database
};

// Utility function to send a push notification to the employee
export const sendPushNotification = async (
  fcmToken,
  title,
  message,
  data = {},
  dryRun = false
) => {
  console.log(`Sending notification to FCM token: ${fcmToken}`);

  // Convert all values in data to strings
  const stringifiedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)]) // Convert values to strings
  );

  const notificationPayload = {
    notification: {
      title,
      body: message,
    },
    data: {
      ...stringifiedData, // Use the stringified data
      icon: "ic_notification", // Custom icon
      sound: "notificationsound", // Custom sound
    },
    token: fcmToken, // Use the fcmToken passed to the function
  };

  // Define options for priority and content available
  const options = {
    priority: "high", // High priority for immediate delivery
    content_available: true, // Ensures notification is delivered even when app is in foreground
  };

  try {
    // Send the push notification via Firebase Cloud Messaging (FCM) with dryRun and options
    const response = await admin
      .messaging()
      .send(notificationPayload, dryRun, options);

    if (dryRun) {
      console.log("Dry run successful:", response);
    } else {
      console.log("Successfully sent push notification:", response);
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
