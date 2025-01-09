import express from "express";
import {
  registerAdminUser,
  completeAdminRegistration,
  loginAdminUser,
  sendCustomNotification,
  completeAdminLogin,
  logoutAdminUser,
  storeFcmToken,
  sendEmployeeNotification,
  sendBusinessNotification,
  getUniqueBusinessNotifications,
  editAdmin,
  getUniqueEmployeeNotifications,
} from "../controllers/adminControllers/adminAuthController.js";
import {
  updateLiabilityByAdmin,
  getAllLiabilitiesWithDetails,
} from "../controllers/liabilityController.js";

import {
  getCompanySalaryDetails,
  updateEmployeePayment,
} from "../controllers/salaryController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { updateWithdrawalRequestState } from "../controllers/withdrawalRequestController.js";
import {
  getPayments,
  getPaymentStats,
} from "../controllers/adminEmployeeInfoController.js";
const router = express.Router();

// Registration routes
router.post("/register", registerAdminUser);
router.post("/register/complete", completeAdminRegistration);

router.put("/liability/update/:id", updateLiabilityByAdmin);

router.get("/company/salary", getCompanySalaryDetails);
router.put("/employee-payment/:_id", updateEmployeePayment);
router.get("/get/liability/all", getAllLiabilitiesWithDetails);
router.get("/payments", getPayments);
router.get("/payment-stats", getPaymentStats);
// Login routes
router.post("/login", loginAdminUser);
router.post("/login/complete", completeAdminLogin);

// Logout route
router.post("/logout", logoutAdminUser);

router.post("/send-employee-notification", protect, sendEmployeeNotification);
router.post("/send-business-notification", protect, sendBusinessNotification);

// Route to get unique notifications sent to employees
router.get(
  "/unique-employee-notifications",
  protect,
  getUniqueEmployeeNotifications
);

// Route to get unique notifications sent to business accounts
router.get(
  "/unique-business-notifications",
  protect,
  getUniqueBusinessNotifications
);

router.put("/store-fcm-token", protect, storeFcmToken);
router.post("/notifications/send", sendCustomNotification);
router.put(
  "/withdrawal-requests/:requestId",
  protect,
  updateWithdrawalRequestState
);
router.put("/edit/admin/:id", editAdmin);
export default router;
