import express from "express";
import {
  createLeaveRequest,
  getEmployeeLeaveRequests,
  getCompanyLeaveRequests,
  updateLeaveRequestStatus,
} from "../controllers/leaveManagementController.js";
import { protect } from "../middlewares/authMiddleware.js"; // Middleware for JWT authentication

const router = express.Router();

// POST route to create a leave request (for employees)
router.post("/leave-requests", protect, createLeaveRequest);

// GET route to fetch all leave requests for an employee
router.get("/leave-requests", protect, getEmployeeLeaveRequests);

// GET route to fetch all leave requests for a company (for employers)
router.get("/company/leave-requests", protect, getCompanyLeaveRequests);

// PUT route to approve or reject a leave request (for employers)
router.put(
  "/leave-requests/:requestId/status",
  protect,
  updateLeaveRequestStatus
);
router.get("/admin/leave-metrics", getLeaveRequestMetrics);
export default router;
