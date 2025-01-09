import express from "express";
import {
  registerUser,
  completeRegistration,
  loginUser,
  completeLogin,
  logoutUser,
  getAllEmployees,
  getEmployeeProfile,
  updateEmployeeStatus,
  deleteEmployee,
  getEmployeeDocument,
  updateHiringStatus,
  getEmployeeProfileById,
  registerUserWithJWT,
  completeRegistrationWithJWT,
  getAllSignupsCounts,
} from "../controllers/userAuthController.js";
import { protect } from "../middlewares/authMiddleware.js";

import {
  getLiabilitiesForEmployee,
  updateLiabilityStatusByEmployee,
} from "../controllers/liabilityController.js";
const router = express.Router();

// Registration routes
router.post("/register", registerUser);
router.post("/register/complete", completeRegistration);

router.get("/signups/all-counts", getAllSignupsCounts);

// Login routes
router.post("/login", loginUser);
router.post("/login/complete", completeLogin);

// Logout route
router.post("/logout", logoutUser);
router.post("/admin/register/complete", completeRegistrationWithJWT);
router.post("/admin/register", registerUserWithJWT);

router.get("/liability/employee", protect, getLiabilitiesForEmployee);

router.put(
  "/employee/liability/update-status/:id",
  protect,
  updateLiabilityStatusByEmployee
);
//For admin panel
//get route to get list of all registered employees
router.get("/employee/listOfAllEmployees", getAllEmployees);
//get route to get a particular employee's textual information
router.get("/employee/:formattedId", getEmployeeProfile);
router.get("/employee/id/:id", getEmployeeProfileById);
//get route to get a particular employee's documents
router.get("/employee/doc/:employeeId", getEmployeeDocument);
//put route to update the status of an employee
router.put("/employee/:employeeId", updateEmployeeStatus);
//put route to update the hiring status of an employee
router.put("/employee/status/:employeeId", updateHiringStatus);
//delete route to delete a particular employee
router.delete("/employee/:employeeId", deleteEmployee);

export default router;
