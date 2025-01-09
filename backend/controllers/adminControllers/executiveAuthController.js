import ExecutiveTeam from '../../models/admin/executiveTeam.model.js';
import TempExecRegistration from '../../models/admin/execTempRegistration.model.js';
import asyncHandler from "../../handlers/asyncHandler.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {generateToken, generateTempToken, verifyTempToken}  from "../../utils/generateToken.js";
import {
    formatPhoneNumber,
    parseDate,
} from '../../handlers/utilsHandler.js';
import { sendOTP, verifyOTP } from "../../utils/otpService.js";
import Admin from '../../models/admin/admin.model.js';
function generateFormattedId() {
    const randomAlphabet = () => String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    const randomNumber = () => Math.floor(Math.random() * 10); // 0-9

    // Generate random alphabets for 'xx'
    const xx = randomAlphabet() + randomAlphabet();

    // Generate random numbers for 'yy'
    const yy = randomNumber().toString() + randomNumber().toString();

    // Generate random numbers for 'zzzz'
    const zzzz =
        randomNumber().toString() +
        randomNumber().toString() +
        randomNumber().toString() +
        randomNumber().toString();

    // Combine to form the final ID
    return `EXEC-${xx}${yy}-${zzzz}`;
}

const generateOTP = () => {
  // Generate a random 4-digit number
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp.toString(); // Convert it to a string if needed
};

const getAllAdmins = asyncHandler(async (req, res) => {
  try {
    // Fetch all admins and populate the createdBy field with ExecutiveTeam details
    const admins = await Admin.find().populate('createdBy', 'name email role');

    // If no admins found
    if (!admins) {
      res.status(404);
      throw new Error("No admins found");
    }

    res.status(200).json(admins);
  } catch (err) {
    res.status(500);
    throw new Error(err.message);
  }
});

// @desc    Register a new exec user
// @route   POST /api/exec/register
// @access  Public
const registerExecUser = asyncHandler(async (req, res, next) => {
    try {
        const { email, password: plainPassword, phoneNumber: pn, name } = req.body;

        // Format the phone number
        const phoneNumber = formatPhoneNumber(pn);

        // Check if the email or phone number is already in use
        const existingExec = await ExecutiveTeam.findOne({ $or: [{ phoneNumber }, { email }] });
        if (existingExec) {
            res.status(400);
            throw new Error("Email or phone number already in use");
        }

        // Create a temporary registration record
        const verificationSid = await sendOTP(phoneNumber);
        await TempExecRegistration.create({
          phoneNumber,
            email,
            name,
            password: plainPassword,
            verificationSid,
        });

        // Store verification details in session
        req.session.phoneNumber = phoneNumber;
        req.session.verificationSid = verificationSid;

        res.status(201).json({ message: "OTP sent successfully" });
    } catch (err) {
        res.status(500);
        next(err);
    }
});


  // @desc    Complete registration after OTP verification
  // @route   POST /api/exec/register/complete
  // @access  Public
const completeExecRegistration = asyncHandler(async (req, res, next) => {
  try {
    const { otp } = req.body;
    const { phoneNumber, verificationSid } = req.session;

    const tempReg = await TempExecRegistration.findOne({ verificationSid, phoneNumber });

    if (!tempReg) {
      return res.status(400).json({ message: "Registration session expired or invalid" });
    }

    const status = await verifyOTP(phoneNumber, otp);
    if (status !== "approved") {
      return res.status(401).json({ message: "Invalid or expired OTP" });
      }
      const formattedId = generateFormattedId();
      // Create the new executive user
      const newExec = await ExecutiveTeam.create({
        phoneNumber: tempReg.phoneNumber,
        email: tempReg.email,
        name: tempReg.name,
        password: tempReg.password, // Save the hashed password
        role: "exec",
        UUID: formattedId
      });

      await newExec.save();

      const token = generateToken(phoneNumber, "exec", newExec._id);

      await TempExecRegistration.deleteOne({ verificationSid });
      req.session.destroy();

      res.status(201).json({
        _id: newExec._id,
        phoneNumber: newExec.phoneNumber,
        email: newExec.email,
        name: newExec.name,
        role: newExec.role,
        UUID: newExec.UUID,
        token: token,
      });
    } catch (err) {
      // Send 500 status code for unhandled errors
      res.status(500);
      next(err);
    }
  });

// @desc    Authenticate exec user & get token
// @route   POST /api/exec/login
// @access  Public
const loginExecUser = asyncHandler(async (req, res) => {
  try {
      const { email, password } = req.body;

      // Check if the user exists
      const user = await ExecutiveTeam.findOne({ email });
      if (!user) {
          res.status(401);
          throw new Error("Invalid email or password");
      }

      // Validate the password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          res.status(401);
          throw new Error("Invalid email or password");
      }

      // Format the phone number by removing +91 if present
      const formattedPhoneNumber = user.phoneNumber.replace(/^(\+91)/, '');

      // Generate and send OTP
      const otp = generateOTP(); // Assuming you have a function to generate OTP
      const verificationSid = await sendOTP(formattedPhoneNumber, otp, req); // Send OTP and save to session

      // Store necessary information in the session
      req.session.phoneNumber = formattedPhoneNumber; // Store formatted phone number in session
      req.session.otp = otp; // Store the OTP in the session for verification later

      // Generate a temporary token with a short expiration time
      const tempToken = generateTempToken({ phoneNumber: formattedPhoneNumber, verificationSid, otp }, '10m'); // Expires in 10 minutes

      res.status(200).json({
          message: "OTP sent successfully",
          tempToken // Return the temporary token
        });
    } catch (err) {
        console.error("Error in loginExecUser:", err.message);

        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
    }
});

const completeExecLogin = asyncHandler(async (req, res) => {
  try {
      const { otp, tempToken } = req.body;

      // Verify the temporary token and extract the payload
      const decoded = verifyTempToken(tempToken);
      if (!decoded) {
          console.error("Invalid or expired temporary token");
          return res.status(401).json({ message: "Invalid or expired temporary token" });
      }

      // Destructure phoneNumber and verificationSid from decoded token
      let { phoneNumber, verificationSid, otp: tokenOtp } = decoded;
      phoneNumber = `+91${phoneNumber}`; // Ensure the phone number is in the correct format

      // Log the phone number being searched
      console.log(`Searching for user with phone number: ${phoneNumber}`);

      // Find user based on phone number
      const user = await ExecutiveTeam.findOne({ phoneNumber });
      if (!user) {
          console.log(`User not found for phone number: ${phoneNumber}`);
          return res.status(404).json({ message: "User not found" });
      }

      // Log user found
      console.log(`User found: ${JSON.stringify(user)}`);

      // Verify OTP using the OTP from the decoded token
      const status = await verifyOTP(otp, tokenOtp);
      console.log(`OTP verification status for phone number ${phoneNumber}: ${status}`);

      // If OTP is valid, generate the final token and send response
      if (status !== "approved") {
          return res.status(401).json({ message: "Invalid or expired OTP" });
      }

      // Generate the final token
      const token = generateToken(phoneNumber, "exec", user._id);

      res.status(201).json({
          _id: user._id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          name: user.name,
          role: user.role,
          token: token,
      });
  } catch (error) {
      console.error("Error during completeExecLogin:", error.message);
      res.status(500).json({ message: "Failed to verify OTP" });
  }
});

const deleteAdminById = async (req, res) => {
  const { id } = req.params;

  try {
      // Find and delete the admin by ID
      const admin = await Admin.findById(id);

      if (!admin) {
          return res.status(404).json({ message: 'Admin not found' });
      }

      await admin.remove();

      res.status(200).json({ message: 'Admin deleted successfully' });
  } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Logout exec user / clear cookie
// @route   POST /api/exec/logout
// @access  Public
const logoutExecUser = (req, res) => {
req.session.destroy();
res.status(201).json({ message: "Logged out successfully" });
};

export {
  registerExecUser,
  completeExecRegistration,
  loginExecUser,
  completeExecLogin,
  logoutExecUser,
  getAllAdmins,
  deleteAdminById
};