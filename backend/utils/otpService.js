import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const SMS_API_URL = process.env.SMS_API_URL;
const SMS_AUTH_KEY = process.env.SMS_API_KEY;
const SENDER_ID = process.env.SMS_SENDER_ID || "OFBEAT";
const ROUTE = "dlt";
import TempRegistration from "../models/employee/employeeTempResistration.model.js";
// Function to send OTP (generated in the controller) and store it in the session
export const sendOTP = async (phoneNumber, otp, req) => {
  try {
    // Construct API request parameters
    const params = {
      authorization: SMS_AUTH_KEY,
      route: ROUTE,
      sender_id: SENDER_ID,
      message: "449", // Assuming '449' is an identifier for the OTP message
      variables_values: otp,
      numbers: phoneNumber,
      flash: "0",
    };

    // Send the OTP via Fast2SMS
    await axios.get(SMS_API_URL, { params });

    // Store OTP and phone number in the session
    req.session.otp = otp;
    req.session.phoneNumber = phoneNumber;

    console.log("OTP saved in session:", otp); // For debugging purposes
    console.log("Session after setting OTP:", req.session);
    return otp; // Return OTP for testing or logging
  } catch (error) {
    console.error("Failed to send OTP", error);
    throw new Error("Failed to send OTP");
  }
};

// Function to verify the OTP by comparing input with session OTP
export const verifyOTP = (inputOtp, storedOtp) => {
  console.log("Input OTP:", inputOtp);
  console.log("Stored OTP:", storedOtp);
  return inputOtp === storedOtp ? "approved" : "denied";
};

// Function to send OTP without using session
export const sendOTPNoSession = async (phoneNumber, otp) => {
  try {
    const params = {
      authorization: SMS_AUTH_KEY,
      route: ROUTE,
      sender_id: SENDER_ID,
      message: "449", // Message template ID
      variables_values: otp,
      numbers: phoneNumber,
      flash: "0",
    };

    // Send the OTP via Fast2SMS
    await axios.get(SMS_API_URL, { params });

    console.log("OTP sent without session:", otp); // For debugging purposes
    return otp; // Return OTP to be stored or verified as needed
  } catch (error) {
    console.error("Failed to send OTP", error);
    throw new Error("Failed to send OTP");
  }
};

// Function to verify OTP directly
export const verifyOTPNoSession = (inputOtp, storedOtp) => {
  console.log("Input OTP:", inputOtp);
  console.log("Stored OTP:", storedOtp);
  return inputOtp === storedOtp ? "approved" : "denied";
};

export const getStoredOTP = async (phoneNumber) => {
  try {
    // Find the temporary registration document by phoneNumber
    const tempReg = await TempRegistration.findOne({ phoneNumber });

    if (!tempReg) {
      console.log("No temporary registration found for this phone number");
      return null; // No OTP found
    }

    return tempReg.verificationSid; // Return the OTP associated with the phone number
  } catch (error) {
    console.log("Error fetching stored OTP:", error);
    return null; // In case of any error, return null
  }
};
