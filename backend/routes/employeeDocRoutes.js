import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  loginUser,
  registerUser,
  logoutUser,
} from "../controllers/userAuthController.js";
import {
  getDocumentData,
  handleDocumentUpload,
  handleOtherDocumentUpload,
  handleDocumentReplace,
} from "../controllers/employeeDocController.js";
import {
  getAadharDetails,
  sendAadhaarOTP,
  verifyAndSaveAadhaar,
} from "../controllers/employeeAadharController.js";
import {
  getEmployeeInfo,
  handleEmployeeInfoUpdate,
  qrCode,
  employeeProfileUpdate,
  updateWorkStatus,
  sendEmployeeCompanyRequest,
  updateFreeSubscription,
  getAllReferralDetails,
  submitThirdPartyCompany,
  getReferralDetails,
  getEmployeeTransactions,
  updateSkipStatus,
  storeFcmToken,
  getEmployeeDocumentCounts,
} from "../controllers/employeeInfoController.js";
import {
  createWithdrawalRequest,
  getWithdrawalRequests,
} from "../controllers/withdrawalRequestController.js";
import { upload } from "../middlewares/multerMiddleware.js";
import { isEmployeeVerified } from "../controllers/employeeVerificationStatusController.js";
import { handleWebhook } from "../controllers/webhookController.js";
import {
  createPremiumSubscription,
  checkPaymentStatus,
} from "../controllers/employeeSubscriptionController.js";
import {
  createLeaveRequest,
  getEmployeeLeaveRequests,
  getLeaveRequestMetrics,
} from "../controllers/leaveManagementController.js";
import { maskAadhaar } from "../controllers/aadharController.js";
import {
  createPaymentRequest,
  getEmployeePaymentRequests,
  getAdvancePaymentMetrics,
} from "../controllers/advancePaymentController.js";
import uploadDoc from "../middlewares/uploadMiddleware.js";

import { updateLiabilityStatusByEmployee } from "../controllers/liabilityController.js";
import {
  trackReferralClick,
  fetchReferralData,
} from "../controllers/referralController.js";
import {
  getEmployeeSalaryDetails,
  generateSalarySlip,
} from "../controllers/salaryController.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

router.get("/employees/document-counts", getEmployeeDocumentCounts);

router.get("/generate-salary-slip", protect, generateSalarySlip);
router.get("/salary/slip/:employeeId?", protect, getEmployeeSalaryDetails);

router.put("/liability/update-status/:id", updateLiabilityStatusByEmployee);

router.post("/mask-aadhaar", upload.single("aadhaar-image"), maskAadhaar);
//get apis for employee textual and documented information
router.get("/employee-info", protect, getEmployeeInfo);
router.get("/employee-documents", protect, getDocumentData);
router.get("/checkCompletion", protect, isEmployeeVerified);
router.get("/qr-code", protect, qrCode);
// GET API to retrieve stored Aadhaar details and documents
router.get("/aadhar", protect, getAadharDetails);
router.put("/store-fcm-token", protect, storeFcmToken);
router.post(
  "/employee-documents",
  protect,
  upload.fields([{ name: "facePhoto", maxCount: 1 }]),
  handleDocumentUpload
);

// GET: Tracks referral click and redirects to Play Store
router.get("/referral/track-click", trackReferralClick);

// GET: Matches deviceId with referral data
router.get("/referral/match", fetchReferralData);

router.put(
  "/candidate/document/replace",
  protect,
  upload.fields([
    { name: "frontPhoto", maxCount: 1 },
    { name: "backPhoto", maxCount: 1 },
  ]),
  handleDocumentReplace
);
// Route for sending Aadhar OTP
router.post("/send-aadhaar-otp", protect, sendAadhaarOTP);
// Route for verifying OTP and saving Aadhar details

router.post("/verify-aadhaar-and-save", protect, verifyAndSaveAadhaar);
//Route for subscribing to a plan(premium)
router.post("/subscribe", protect, createPremiumSubscription);
//Route to check status for payment
router.get("/checkStatus", protect, checkPaymentStatus);
router.post("/updateFreeSubscription", protect, updateFreeSubscription);
//Route for webhook
router.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);
router.get("/admin/leave-metrics", getLeaveRequestMetrics);
// Route for storing and updating employee's textual information
router.put("/employee-info", protect, handleEmployeeInfoUpdate);
router.put("/profile/edit", protect, employeeProfileUpdate);
router.put("/workStatus", protect, updateWorkStatus);
router.put("/linkCompany/:companyId", protect, sendEmployeeCompanyRequest);
router.post("/third-party-companies", protect, submitThirdPartyCompany);
router.post(
  "/upload/other",
  protect,
  upload.fields([
    { name: "frontPhoto", maxCount: 1 },
    { name: "backPhoto", maxCount: 1 },
  ]),
  handleOtherDocumentUpload
);
router.get("/withdrawal-requests", protect, getWithdrawalRequests);

router.post("/withdrawal", protect, createWithdrawalRequest);
router.get("/employee/transactions", protect, getEmployeeTransactions);
router.get("/referral-details", protect, getReferralDetails);
router.get("/referrals/all", protect, getAllReferralDetails);

// POST route to create a leave request (for employees)
router.post("/leave-requests", protect, createLeaveRequest);

// GET route to fetch all leave requests for an employee
router.get("/leave-requests", protect, getEmployeeLeaveRequests);

router.post("/create/advance-payment", protect, createPaymentRequest);
router.get(
  "/advance-payment/all-requests",
  protect,
  getEmployeePaymentRequests
);

router.put("/update-skip-status", protect, updateSkipStatus);
router.get("/admin/advance-metrics", getAdvancePaymentMetrics);
export default router;
