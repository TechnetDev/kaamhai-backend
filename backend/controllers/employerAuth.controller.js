import asyncHandler from "../handlers/asyncHandler.js";
import { generateToken } from "../utils/generateToken.js";
import EmployerAuthModel from "../models/business/employerAuth.model.js";
import EmployerTempRegistration from "../models/business/employerTempRegistration.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import { sendOTP, verifyOTP } from "../utils/otpService.js";
import { formatPhoneNumber } from "../handlers/utilsHandler.js";
import Company from "../models/company.model.js";
import EmployerReferralModel from "../models/businessReferral.model.js";
import jwt from "jsonwebtoken";
import { sendOTPNoSession, getStoredOTP } from "../utils/otpService.js";

const generateJWTToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const generateOTP = () => {
  // Generate a random 4-digit number
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp.toString(); // Convert it to a string if needed
};

// @desc    Authenticate employer & get token
// @route   POST /api/auth/employer/login
// @access  Public
const loginEmployer = asyncHandler(async (req, res) => {
  const { phoneNumber: pn } = req.body;

  // Ensure the phone number is defined
  if (!pn) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  // Format the phone number
  const phoneNumber = formatPhoneNumber(pn); // Ensure it formats the phone number correctly

  console.log(`Phone number received: ${phoneNumber}`);

  // Check if the employer exists
  const employer = await BusinessAccount.findOne({
    "basicDetails.phoneNumber": phoneNumber,
  });
  console.log(employer);

  if (!employer) {
    console.log("User not found");
    return res.status(404).json({ message: "User not found" });
  }

  let verificationSid;

  // Check if the phone number is the demo number
  if (phoneNumber === "+919850132687") {
    verificationSid = "DEMO_VERIFICATION_SID";
    console.log("Using demo verification SID");
  } else {
    // Generate OTP for non-demo numbers
    const otp = generateOTP(); // Make sure you have a function to generate OTP

    // Send OTP and handle session management
    try {
      verificationSid = await sendOTP(pn, otp, req); // Send OTP and store in session
      console.log("OTP sent successfully");
    } catch (error) {
      console.error("Error sending OTP:", error.message);
      return res.status(500).json({ message: "Error sending OTP" });
    }
  }

  // Store verification details in session
  req.session.phoneNumber = phoneNumber;
  req.session.verificationSid = verificationSid; // This could be used later for OTP verification

  res.status(201).json({ message: "OTP sent successfully" });
});

// @desc    Complete login after OTP verification
// @route   POST /api/auth/employer/login/complete
// @access  Public
const completeLoginEmployer = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const { phoneNumber, verificationSid } = req.session;

  // Check if the phone number is the demo number
  if (phoneNumber === "+919850132687") {
    // For demo number, bypass OTP verification
    if (otp === "9999") {
      const user = await BusinessAccount.findOne({
        "basicDetails.phoneNumber": phoneNumber,
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const token = generateToken(phoneNumber, "employer", user._id);
      req.session.destroy();

      return res.status(201).json({
        message: "User verified successfully!",
        _id: user._id,
        phoneNumber: user.basicDetails.phoneNumber,
        name: user.basicDetails.fullName,
        token: token,
      });
    } else {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }
  }

  const user = await BusinessAccount.findOne({
    "basicDetails.phoneNumber": phoneNumber,
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  try {
    const status = await verifyOTP(otp, req.session.otp);
    if (status !== "approved") {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    const token = generateToken(phoneNumber, "employer", user._id);
    req.session.destroy();

    res.status(201).json({
      message: "User verified successfully!",
      _id: user._id,
      phoneNumber: user.basicDetails.phoneNumber,
      name: user.basicDetails.fullName,
      token: token,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
});

// @desc    Register a new employer
// @route   POST /api/auth/employer/register
// @access  Public
const registerEmployer = asyncHandler(async (req, res) => {
  const {
    phoneNumber: pn,
    name,
    email,
    plotNo,
    city,
    state,
    pincode,
    referralCode,
  } = req.body;

  const phoneNumber = formatPhoneNumber(pn);
  console.log(
    `Registering employer with phone number: ${phoneNumber} and referral code: ${referralCode}`
  );

  const existingBusinessAccount = await BusinessAccount.findOne({
    "basicDetails.phoneNumber": phoneNumber,
  });
  if (existingBusinessAccount) {
    console.log("Phone number already in use.");
    res.status(400);
    throw new Error("Phone number already in use");
  }

  const tempReg = await EmployerTempRegistration.findOne({ phoneNumber });
  if (tempReg) {
    console.log(
      "Phone number already registered in temp, please complete OTP verification."
    );
    res.status(400);
    throw new Error(
      "Phone number already registered, please complete OTP verification"
    );
  }

  let verificationSid;

  // Check if the phone number is the demo number
  if (phoneNumber === "+919850132687") {
    verificationSid = "DEMO_VERIFICATION_SID";
  } else {
    const otp = generateOTP(); // Generate the OTP
    const phoneNumberWithoutPrefix = pn.startsWith("+91") ? pn.slice(3) : pn; // Remove the +91 prefix
    verificationSid = await sendOTP(phoneNumberWithoutPrefix, otp, req); // Send the OTP without +91
  }

  console.log(`Generated verification SID: ${verificationSid}`);

  await EmployerTempRegistration.create({
    phoneNumber,
    name,
    verificationSid,
    referralCode,
  });

  req.session.phoneNumber = phoneNumber;
  req.session.verificationSid = verificationSid;
  req.session.name = name;
  req.session.email = email;
  req.session.plotNo = plotNo;
  req.session.city = city;
  req.session.state = state;
  req.session.pincode = pincode;
  req.session.referralCode = referralCode;

  res.status(201).json({ message: "OTP sent successfully" });
});

const completeRegistrationEmployer = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const {
    phoneNumber,
    verificationSid,
    name,
    email,
    plotNo,
    city,
    state,
    pincode,
    referralCode,
  } = req.session;

  console.log(
    `Completing registration for phone number: ${phoneNumber} with OTP: ${otp} and referralCode: ${referralCode}`
  );
  const formattedPhoneNumber = phoneNumber.replace(/^\+91/, "");
  const tempReg = await EmployerTempRegistration.findOne({
    verificationSid,
    phoneNumber,
  });

  if (!tempReg) {
    console.log(
      "No matching temp registration found, invalid session or expired."
    );
    return res
      .status(400)
      .json({ message: "Registration session expired or invalid" });
  }

  if (formattedPhoneNumber === "9850132687") {
    if (otp === "9999") {
      const referredBy = referralCode
        ? await BusinessAccount.findOne({
            $or: [
              { "basicDetails.phoneNumber": referralCode },
              { referralCode: referralCode },
            ],
          })
        : null;

      console.log(
        `Demo mode. Found referredBy: ${
          referredBy ? referredBy.basicDetails.phoneNumber : null
        }`
      );

      const newBusinessAccount = await BusinessAccount.create({
        basicDetails: {
          fullName: name,
          email,
          phoneNumber: phoneNumber,
        },
        address: {
          plotNo,
          city,
          state,
          pincode,
        },
        isCompleted: false,
        isVerified: false,
        referralCode: phoneNumber,
        referredBy: referredBy ? referredBy.basicDetails.phoneNumber : null,
      });

      if (referredBy) {
        await BusinessAccount.findByIdAndUpdate(
          referredBy._id,
          { $inc: { wallet: 20, totalEarned: 20 } },
          { new: true }
        );
        console.log(
          `Referred by ${referredBy.basicDetails.phoneNumber}, updated wallet and totalEarned by +20.`
        );

        // Update the EmployerReferralModel
        await EmployerReferralModel.findOneAndUpdate(
          { referrerEmployerId: referredBy._id },
          { $push: { referees: newBusinessAccount._id } },
          { upsert: true, new: true }
        );
        console.log(
          `Added newBusinessAccount._id to referees of referrer: ${referredBy._id}`
        );
      }

      const token = generateToken(
        phoneNumber,
        "employer",
        newBusinessAccount._id
      );
      await EmployerTempRegistration.deleteOne({ verificationSid });
      req.session.destroy();

      return res.status(201).json({
        message: "User Registered successfully!",
        _id: newBusinessAccount._id,
        phoneNumber: phoneNumber,
        name: name,
        email: email,
        plotNo: plotNo,
        city: city,
        state: state,
        pincode: pincode,
        token: token,
      });
    } else {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }
  }

  try {
    const status = await verifyOTP(otp, req.session.otp);
    if (status !== "approved") {
      console.log("OTP verification failed.");
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    const referredBy = referralCode
      ? await BusinessAccount.findOne({
          $or: [
            { "basicDetails.phoneNumber": formatPhoneNumber(referralCode) },
            { referralCode: referralCode },
          ],
        })
      : null;

    console.log(
      `Found referredBy: ${
        referredBy ? referredBy.basicDetails.phoneNumber : null
      }`
    );

    const newBusinessAccount = await BusinessAccount.create({
      basicDetails: {
        fullName: name,
        email,
        phoneNumber: phoneNumber,
      },
      address: {
        plotNo,
        city,
        state,
        pincode,
      },
      isCompleted: false,
      isVerified: false,
      referralCode: phoneNumber,
      referredBy: referredBy ? referredBy.basicDetails.phoneNumber : null,
    });

    if (referredBy) {
      await BusinessAccount.findByIdAndUpdate(
        referredBy._id,
        { $inc: { wallet: 20, totalEarned: 20 } },
        { new: true }
      );
      console.log(
        `Referred by ${referredBy.basicDetails.phoneNumber}, updated wallet and totalEarned by +20.`
      );

      // Update the EmployerReferralModel
      await EmployerReferralModel.findOneAndUpdate(
        { referrerEmployerId: referredBy._id },
        { $push: { referees: newBusinessAccount._id } },
        { upsert: true, new: true } // Create a new entry if it doesn't exist
      );
      console.log(
        `Added newBusinessAccount._id to referees of referrer: ${referredBy._id}`
      );
    }

    const token = generateToken(
      phoneNumber,
      "employer",
      newBusinessAccount._id
    );
    await EmployerTempRegistration.deleteOne({ verificationSid });
    req.session.destroy();

    res.status(201).json({
      message: "User Registered successfully!",
      _id: newBusinessAccount._id,
      phoneNumber: phoneNumber,
      name: name,
      email: email,
      plotNo: plotNo,
      city: city,
      state: state,
      pincode: pincode,
      token: token,
    });
  } catch (error) {
    console.error("Error during OTP verification or account creation:", error);
    res.status(500).json({
      message: "Failed to verify OTP or create business account",
      error: error.message,
    });
  }
});

const registerEmployerWithJWT = asyncHandler(async (req, res) => {
  try {
    console.log(req.body);
    const {
      phoneNumber: pn,
      name,
      email,
      plotNo,
      city,
      state,
      pincode,
      referralCode,
    } = req.body;

    // Format the phone number
    const phoneNumber = formatPhoneNumber(pn);
    console.log(
      `Registering employer with formatted phone number: ${phoneNumber} and referral code: ${referralCode}`
    );

    // Check if phone number is already in use
    const existingBusinessAccount = await BusinessAccount.findOne({
      "basicDetails.phoneNumber": phoneNumber,
    });
    if (existingBusinessAccount) {
      console.log("Phone number already in use.");
      return res.status(400).json({ message: "Phone number already in use" });
    }

    // Check if phone number is already in temp registration
    const tempReg = await EmployerTempRegistration.findOne({ phoneNumber });
    if (tempReg) {
      console.log(
        "Phone number already registered in temp, please complete OTP verification."
      );
      return res
        .status(400)
        .json({
          message:
            "Phone number already registered, please complete OTP verification",
        });
    }

    let verificationSid;

    // Check if the phone number is the demo number
    if (phoneNumber === "+919850132687") {
      verificationSid = "DEMO_VERIFICATION_SID";
    } else {
      // Generate the OTP
      const otp = generateOTP();

      // Format phone number to remove +91 prefix if present
      const phoneNumberWithoutPrefix = pn.startsWith("+91") ? pn.slice(3) : pn;

      // Send OTP without session
      verificationSid = await sendOTPNoSession(phoneNumberWithoutPrefix, otp);
      console.log(
        `OTP sent to ${phoneNumberWithoutPrefix}. Verification SID: ${verificationSid}`
      );
    }

    // Set the referralCode to the formatted phoneNumber if referralCode is empty
    const finalReferralCode = referralCode || phoneNumber;

    // Create a temp registration entry
    console.log(`Storing temp registration for ${phoneNumber}`);
    await EmployerTempRegistration.create({
      phoneNumber,
      name,
      verificationSid,
      referralCode: finalReferralCode,
    });

    // Generate JWT token with the necessary payload
    const tokenPayload = {
      phoneNumber,
      verificationSid,
      name,
      email,
      plotNo,
      city,
      state,
      pincode,
      referralCode: finalReferralCode,
    };
    const token = generateJWTToken(tokenPayload);

    console.log(`Generated JWT token for ${phoneNumber}`);

    res.status(201).json({ message: "OTP sent successfully", token });
  } catch (error) {
    console.error("Error in registerEmployerWithJWT:", error.message);
    res.status(500).json({
      message: "Failed to register employer",
      error: error.message,
    });
  }
});

const completeRegistrationEmployerWithJWT = asyncHandler(async (req, res) => {
  const { otp, token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const {
      phoneNumber,
      verificationSid,
      name,
      email,
      plotNo,
      city,
      state,
      pincode,
      referralCode,
    } = decoded;

    console.log(
      `Completing registration for phone number: ${phoneNumber} with OTP: ${otp} and referralCode: ${referralCode}`
    );

    const tempReg = await EmployerTempRegistration.findOne({
      verificationSid,
      phoneNumber,
    });

    if (!tempReg) {
      console.log(
        "No matching temp registration found, invalid session or expired."
      );
      return res
        .status(400)
        .json({ message: "Registration session expired or invalid" });
    }

    // Demo number OTP verification
    if (phoneNumber === "+919850132687" && otp === "9999") {
      const referredBy = referralCode
        ? await BusinessAccount.findOne({
            $or: [
              { "basicDetails.phoneNumber": referralCode },
              { referralCode: referralCode },
            ],
          })
        : null;

      console.log(
        `Demo mode. Found referredBy: ${
          referredBy ? referredBy.basicDetails.phoneNumber : null
        }`
      );

      const newBusinessAccount = await BusinessAccount.create({
        basicDetails: {
          fullName: name,
          email,
          phoneNumber: phoneNumber,
        },
        address: {
          plotNo,
          city,
          state,
          pincode,
        },
        isCompleted: false,
        isVerified: false,
        referralCode: phoneNumber,
        referredBy: referredBy ? referredBy.basicDetails.phoneNumber : null,
      });

      if (referredBy) {
        await BusinessAccount.findByIdAndUpdate(
          referredBy._id,
          { $inc: { wallet: 20, totalEarned: 20 } },
          { new: true }
        );
        console.log(
          `Referred by ${referredBy.basicDetails.phoneNumber}, updated wallet and totalEarned by +20.`
        );

        // Update the EmployerReferralModel
        await EmployerReferralModel.findOneAndUpdate(
          { referrerEmployerId: referredBy._id },
          { $push: { referees: newBusinessAccount._id } },
          { upsert: true, new: true }
        );
        console.log(
          `Added newBusinessAccount._id to referees of referrer: ${referredBy._id}`
        );
      }

      const authToken = generateToken(
        phoneNumber,
        "employer",
        newBusinessAccount._id
      );
      await EmployerTempRegistration.deleteOne({ verificationSid });

      return res.status(201).json({
        message: "User Registered successfully!",
        _id: newBusinessAccount._id,
        phoneNumber: phoneNumber,
        name: name,
        email: email,
        plotNo: plotNo,
        city: city,
        state: state,
        pincode: pincode,
        token: authToken,
      });
    }

    // Non-demo number OTP verification
    const status = await verifyOTP(verificationSid, otp); // Pass verificationSid instead of phoneNumber
    if (status !== "approved") {
      console.log("OTP verification failed.");
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    const referredBy = referralCode
      ? await BusinessAccount.findOne({
          $or: [
            { "basicDetails.phoneNumber": formatPhoneNumber(referralCode) },
            { referralCode: referralCode },
          ],
        })
      : null;

    console.log(
      `Found referredBy: ${
        referredBy ? referredBy.basicDetails.phoneNumber : null
      }`
    );

    const newBusinessAccount = await BusinessAccount.create({
      basicDetails: {
        fullName: name,
        email,
        phoneNumber: phoneNumber,
      },
      address: {
        plotNo,
        city,
        state,
        pincode,
      },
      isCompleted: false,
      isVerified: false,
      referralCode: phoneNumber,
      referredBy: referredBy ? referredBy.basicDetails.phoneNumber : null,
    });

    if (referredBy) {
      await BusinessAccount.findByIdAndUpdate(
        referredBy._id,
        { $inc: { wallet: 20, totalEarned: 20 } },
        { new: true }
      );
      console.log(
        `Referred by ${referredBy.basicDetails.phoneNumber}, updated wallet and totalEarned by +20.`
      );

      // Update the EmployerReferralModel
      await EmployerReferralModel.findOneAndUpdate(
        { referrerEmployerId: referredBy._id },
        { $push: { referees: newBusinessAccount._id } },
        { upsert: true, new: true }
      );
      console.log(
        `Added newBusinessAccount._id to referees of referrer: ${referredBy._id}`
      );
    }

    const authToken = generateToken(
      phoneNumber,
      "employer",
      newBusinessAccount._id
    );
    await EmployerTempRegistration.deleteOne({ verificationSid });

    res.status(201).json({
      message: "User Registered successfully!",
      _id: newBusinessAccount._id,
      phoneNumber: phoneNumber,
      name: name,
      email: email,
      plotNo: plotNo,
      city: city,
      state: state,
      pincode: pincode,
      token: authToken,
    });
  } catch (error) {
    console.error("Error during OTP verification or account creation:", error);
    res.status(500).json({
      message: "Failed to verify OTP or create business account",
      error: error.message,
    });
  }
});

// @desc    Logout employer / clear cookie
// @route   POST /api/auth/employer/logout
// @access  Public
const logoutEmployer = (req, res) => {
  req.session.destroy();
  res.status(201).json({ message: "Logged out successfully" });
};
/*                     APIs for admin panel                        */

// @desc    get all employers
// @route   GET api/business/listOfAllEmployers
// @access  Public
const getAllEmployers = asyncHandler(async (req, res) => {
  try {
    const employers = await BusinessAccount.find();
    res.status(200).json(employers);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving data", error });
  }
});
// @desc    get an employer profile
// @route   GET api/business/employer/:employerId
// @access  Public
const getEmployerById = asyncHandler(async (req, res) => {
  const { employerId } = req.params;
  console.log("Received request with employerId:", employerId);

  try {
    console.log("Attempting to find employer by employerId:", employerId);
    const employer = await BusinessAccount.findById(employerId);

    if (!employer) {
      console.log("Employer not found for employerId:", employerId);
      return res.status(404).json({ message: "Employer not found" });
    }

    console.log("Employer found:", employer);

    res.status(200).json(employer);
    console.log("Successfully sent response with employer details");
  } catch (error) {
    console.error("Error retrieving employer info:", error);
    res.status(500).json({ message: "Error retrieving employer info", error });
  }
});

// @desc    delete an employer profile
// @route   DELETE api/business/employer/:employerId
// @access  Public
const deleteEmployerById = asyncHandler(async (req, res) => {
  const { employerId } = req.params;

  try {
    const deletedEmployer = await BusinessAccount.findByIdAndDelete(employerId);

    if (!deletedEmployer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.status(200).json({ message: "Employer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting employer", error });
  }
});

export {
  loginEmployer,
  completeLoginEmployer,
  registerEmployer,
  completeRegistrationEmployer,
  logoutEmployer,
  getAllEmployers,
  getEmployerById,
  deleteEmployerById,
  completeRegistrationEmployerWithJWT,
  registerEmployerWithJWT,
};
