import express from "express";
import {
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
  // selectYourBusiness
} from "../controllers/businessController.js";
import {
  createBusinessWithdrawalRequest,
  updateEmployerWithdrawalRequestState,
} from "../controllers/withdrawalRequestController.js";
import {
  completeRegistrationEmployer,
  completeLoginEmployer,
  loginEmployer,
  logoutEmployer,
  registerEmployer,
  getAllEmployers,
  getEmployerById,
  deleteEmployerById,
  completeRegistrationEmployerWithJWT,
  registerEmployerWithJWT,
} from "../controllers/employerAuth.controller.js";
import { protect, admin } from "../middlewares/authMiddleware.js";
import checkEmployerProfile from "../controllers/employerVerificationStatusController.js";

import {
  createLiability,
  getLiabilitiesByCompany,
  getLiabilitiesByEmployee,
} from "../controllers/liabilityController.js";

import {
  getCompanyLeaveRequests,
  updateLeaveRequestStatus,
} from "../controllers/leaveManagementController.js";

import {
  getCompanyPaymentRequests,
  updatePaymentRequestStatus,
} from "../controllers/advancePaymentController.js";

import {
  createBusinessAccount,
  getAccountsByEmployer,
  updateBusinessAccount,
  deleteBusinessAccount,
  getAllBusinessBankAccounts,
} from "../controllers/employerBankAccountController.js";

import { upload } from "../middlewares/multerMiddleware.js";

import { getEmployeesAndSalaryForEmployer } from "../controllers/salaryController.js";
const router = express.Router();

// Create a liability request (POST)

import { createPaymentRecord } from "../controllers/salaryController.js";

router.post(
  "/liability/create-liability",
  protect,
  upload.fields([{ name: "liabilityPhoto", maxCount: 1 }]), // Add liabilityPhoto field
  createLiability
);

// Get all liabilities for a company (GET)
router.get("/liabilities/company", protect, getLiabilitiesByCompany);

// Get all liabilities for an employee (GET)
router.get(
  "/liability/employee/:employeeid",
  protect,
  getLiabilitiesByEmployee
);

router.post("/salaryslip/payment", protect, createPaymentRecord);
// Create a new business bank account
router.post("/create/bankaccount", protect, createBusinessAccount);

// Get all accounts associated with the employer
router.get("/accounts/:employerId?", protect, getAccountsByEmployer);

router.get("/all/bank-details", protect, getAllBusinessBankAccounts);

router.get("/salary/list", protect, getEmployeesAndSalaryForEmployer);
router.get(
  "/salary/list/:employerId",
  protect,
  getEmployeesAndSalaryForEmployer
);
// Update a specific business bank account
router.put("/accounts/:id", protect, updateBusinessAccount);

// Delete a specific business bank account
router.delete("/accounts/:id", protect, deleteBusinessAccount);

router.post("/createBusiness", protect, createBusiness);
router.post("/register", registerEmployer);
router.post("/register/complete", completeRegistrationEmployer);

router.post("/admin/register", registerEmployerWithJWT);
router.post("/admin/register/complete", completeRegistrationEmployerWithJWT);

router.post("/login", loginEmployer);
router.post("/login/complete", completeLoginEmployer);
router.post("/logout", logoutEmployer);
router.get("/listOfBusinesses", listOfBusinesses);
router.get("/checkEmployerCompletion", protect, checkEmployerProfile);
// router.post('/selectYourBusiness', selectYourBusiness);
router.put("/edit", protect, updateBusinessName);
router.put("/profile/update", protect, updateBusinessDetails);
//Apis for admin
//get route to fetch all the registered employers
router.get("/listOfAllEmployers", getAllEmployers);
//get route to fetch a particular employer
router.get("/employer/:employerId", getEmployerById);
//delete route to del an employer
router.delete("/employer/:employerId", deleteEmployerById);

router.get("/transactions", protect, getEmployerTransactions);
router.get("/referral-details", protect, getReferralDetails);

router.post("/withdrawal", protect, createBusinessWithdrawalRequest);
router.get("/all/referral-details", getBusinessReferralDetails);
router.get("/withdrawal-requests", getEmployerWithdrawalRequests);

router.put(
  "/withdrawal-requests/:requestId",
  protect,
  admin,
  updateEmployerWithdrawalRequestState
);

router.get("/business-accounts/all-counts", getBusinessAccountSignupsCounts);

router.get("/company/leave-requests", protect, getCompanyLeaveRequests);

// PUT route to approve or reject a leave request (for employers)
router.put(
  "/leave-requests/:requestId/status",
  protect,
  updateLeaveRequestStatus
);

router.get("/compay/advance-pay/requests", protect, getCompanyPaymentRequests);

router.put(
  "/advance-payment/requests/:requestId",
  protect,
  updatePaymentRequestStatus
);

router.put("/store-fcm-token", protect, BusinessFcmToken);
export default router;
