import express from "express";
import {
  updateEmployeeInfo,
  getStats,
} from "../controllers/adminEmployeeInfoController.js";
import {
  updateBusinessAccount,
  updateEmployerStatus,
  getOfferLetterStatistics,
} from "../controllers/adminEmployerInfoController.js";
import {
  updateCompanyInfo,
  getVerifiedCompanies,
} from "../controllers/adminCompanyInfoController.js";
import {
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  deleteLeaveRequest,
} from "../controllers/leaveManagementController.js";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getAllPaymentRequests,
  deletePaymentRequest,
  updatePaymentRequestStatus,
} from "../controllers/advancePaymentController.js";
const router = express.Router();

// @desc    Update employee personal information
// @access  Admin
router.put("/employee/:formattedId/info", updateEmployeeInfo);

// @desc    Update business account information
// @access  Admin
router.put("/businessAccount/:id/info", updateBusinessAccount);

router.put("/businessAccount/:id/status", updateEmployerStatus);

router.put("/company/:id/info", updateCompanyInfo);

router.get("/companies/verified", getVerifiedCompanies);

router.get("/total-candidates", getStats);

router.get("/offer-letters/statistics", getOfferLetterStatistics);

router.get("/leaverequests", protect, getAllLeaveRequests);
router.get("/advancePayments", protect, getAllPaymentRequests);

router.delete(
  "/delete/advancePayRequest/:requestId",
  protect,
  deletePaymentRequest
);

router.put(
  "/advance-payment/requests/:requestId",
  protect,
  updatePaymentRequestStatus
);

router.delete("/delete/leaveRequest/:requestId", protect, deleteLeaveRequest);

router.put(
  "/leave-request/requests/:requestId",
  protect,
  updateLeaveRequestStatus
);
export default router;
