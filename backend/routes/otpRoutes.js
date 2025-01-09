import express from "express";
import {
  sendOtpController,
  verifyOtpController,
} from "../controllers/otpController.js";

const router = express.Router();

// Route to send OTP
router.post("/send", sendOtpController);

// Route to verify OTP
router.post("/verify", verifyOtpController);

export default router;
