import express from "express";
import {
  registerExecUser,
  completeExecRegistration,
  getAllAdmins,
  loginExecUser,
  completeExecLogin,
  logoutExecUser,
  deleteAdminById,
} from "../controllers/adminControllers/executiveAuthController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Registration routes
router.post("/register", registerExecUser);
router.post("/register/complete", completeExecRegistration);

// Login routes
router.post("/login", loginExecUser);
router.post("/login/complete", completeExecLogin);

// Logout route
router.post("/logout", logoutExecUser);
router.delete("/admin/:id", deleteAdminById);
router.get("/all/admins", getAllAdmins);
export default router;
