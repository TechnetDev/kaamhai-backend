import express from "express";
import {
  sendNotification,
  scheduleNotification,
  getEmployeeNotifications,
  getEmployerNotifications,
  getUnreadEmployerNotifications,
  getUnreadEmployeeNotifications,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/send", sendNotification);
router.post("/schedule", scheduleNotification);

// Route for getting employee notifications
router.get("/employee-notifications", protect, getEmployeeNotifications);

// Route for getting employer notifications
router.get("/employer-notifications", protect, getEmployerNotifications);

// Route to get unread employer notifications
router.get("/employer/unread", protect, getUnreadEmployerNotifications);

// Route to get unread employee notifications
router.get("/employee/unread", protect, getUnreadEmployeeNotifications);

export default router;
