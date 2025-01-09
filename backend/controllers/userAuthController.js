import crypto from "crypto";
import { formatPhoneNumber, parseDate } from "../handlers/utilsHandler.js";
import asyncHandler from "../handlers/asyncHandler.js";
import {generateToken} from "../utils/generateToken.js";
import TempRegistration from "../models/employee/employeeTempResistration.model.js";
import { sendOTP, verifyOTP } from "../utils/otpService.js";
import EmployeeAuthModel from "../models/employee/employeeAuth.model.js";
import jwt from "jsonwebtoken";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import Document from "../models/employee/EmployeeDoc.model.js";
import EmployeeDocModel from "../models/employee/EmployeeDoc.model.js";
import { calculateAge } from "../utils/getAgeFromDob.js";
import stateUtils from "../utils/stateUtils.js"
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import ReferralModel from "../models/userReferral.model.js";
import jobPostApplicationsModel from "../models/jobPosts/jobPostApplications.model.js";
import JobPost from "../models/jobPosts/jobPosts.model.js";
import Company from "../models/company.model.js";
import AadhaarVerification from '../models/aadharVerification.model.js';
import { sendOTPNoSession, getStoredOTP } from '../utils/otpService.js';
import BusinessAccount from "../models/business/businessAccount.model.js";
import employeeBankAccountDetails from '../models/employee/employeeBankAccountDetails.js';
//utils

const generateOTP = () => {
  // Generate a random 4-digit number
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp.toString(); // Convert it to a string if needed
};


const generateFormattedId = (employeeAuthData) => {
  const { dob, state } = employeeAuthData;

  // Check if dob is a valid date
  if (!(dob instanceof Date) || isNaN(dob.getTime())) {
    console.error("Invalid or missing date of birth:", dob);
    return "ERROR-INVALID-DATE";
  }

  // Trim and get the state code
  const stateFullName = state.trim();
  const stateCode = stateUtils.getStateCode(stateFullName);

  if (!stateCode) {
    console.error("Invalid or missing state code:", stateFullName);
    return "ERROR-INVALID-STATE";
  }

  // Get the current year and date parts from dob
  const currentYear = new Date().getFullYear().toString().slice(-2); // Last two digits of the current year
  const month = `${dob.getMonth() + 1}`.padStart(2, "0"); // Month from dob
  const year = dob.getFullYear().toString().slice(-2); // Last two digits of year from dob
  // Generate the random part
  const randomNumbers = generateRandomNumbers();

  // Construct the formattedId
  return `${stateCode}${currentYear}-${month}${year}-${randomNumbers}`;
};

// Helper function to generate random numbers in the required format
const generateRandomNumbers = () => {
  const part1 = Math.floor(1000 + Math.random() * 9000).toString();
  const part2 = Math.floor(1000 + Math.random() * 9000).toString();
  return `${part1}-${part2}`;
};


// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  // Destructure phone number directly from the request body
  const { phoneNumber: pn } = req.body;

  // Ensure phoneNumber is defined
  if (!pn) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  // Format the phone number by adding +91 for database lookup
  const formattedPhoneNumber = `+91${pn}`; // Assuming 'pn' is the number without '+91'

  // Check if the user exists with the formatted phone number
  const user = await EmployeeAuthModel.findOne({ phoneNumber: formattedPhoneNumber });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let verificationSid;

  // Check if the phone number is the demo number
  if (formattedPhoneNumber === '+919850132687') {
    verificationSid = "DEMO_VERIFICATION_SID";
  } else {
    // Generate OTP and send for non-demo numbers without +91
    const otp = generateOTP(); // Function to generate OTP, ensure you define this
    verificationSid = await sendOTP(pn,otp,req); // Send OTP without +91
  }

  // Store verification details in session
  req.session.phoneNumber = formattedPhoneNumber; // Store with +91 if needed
  req.session.verificationSid = verificationSid;

  res.status(201).json({ message: "OTP sent successfully" });
});

// @route   POST /api/auth/login/complete
// @access  Public
const completeLogin = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const { phoneNumber, verificationSid } = req.session;

  // Log session details for debugging
  console.log(`Session phoneNumber: ${phoneNumber}, verificationSid: ${verificationSid}`);
  console.log(`Received OTP: ${otp}`);

  // Find user based on phone number
  const user = await EmployeeAuthModel.findOne({ phoneNumber });

  if (!user) {
    console.log('User not found');
    return res.status(404).json({ message: "User not found" });
  }

  // Check if the phone number is the demo number and OTP is the demo OTP
  if (phoneNumber === '+919850132687' && otp === '9999') {
    console.log('Demo phone number and OTP detected');
    try {
      // Generate token for demo user
      const token = generateToken(phoneNumber, "employee", user._id);
      req.session.destroy();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(decoded.userId);
      console.log(decoded.phoneNumber);

      return res.status(201).json({
        _id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        token: token,
      });
    } catch (error) {
      console.log('Error during demo login:', error.message);
      return res.status(500).json({
        message: "Failed to complete demo login",
        error: error.message,
      });
    }
  } else {
    console.log('Normal login process');
    // Normal OTP verification process for other numbers
    try {
      const status = await verifyOTP(otp, req.session.otp);
      console.log(`OTP verification status: ${status}`);
      if (status !== "approved") {
        console.log('Invalid or expired OTP');
        return res.status(401).json({ message: "Invalid or expired OTP" });
      }

      console.log("Generating token with:");
      console.log("PhoneNumber:", phoneNumber);
      console.log("Role:", "employee");
      console.log("UserId:", user._id);
      // If OTP is valid, generate token and send response
      const token = generateToken(phoneNumber, "employee", user._id);
      req.session.destroy();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(decoded.userId);
      console.log(decoded.phoneNumber);

      res.status(201).json({
        _id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        token: token,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to verify OTP",
        error: error.message,
      });
    }
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { phoneNumber: pn, name, referredBy, state, dob: dobStr } = req.body;

  // Format the phone number to include +91 for storage
  const phoneNumber = formatPhoneNumber(pn); // Ensure it stores as +91XXXXXXXXXX

  // Check if the phone number is already in use
  const existingEmployee = await EmployeeAuthModel.findOne({ phoneNumber });
  if (existingEmployee) {
    res.status(400);
    throw new Error("Phone number already in use");
  }

  // Check if the phone number is already registered but OTP verification is incomplete
  const tempReg = await TempRegistration.findOne({ phoneNumber });
  if (tempReg) {
    res.status(400);
    throw new Error(
      "Phone number already registered, please complete OTP verification"
    );
  }

  // Parse the date of birth
  const dob = parseDate(dobStr);
  if (!dob) {
    res.status(400);
    throw new Error("Invalid date of birth format");
  }

  let verificationSid = null;

  // Skip OTP sending for the demo phone number
  if (phoneNumber === '+919850132687') {
    verificationSid = "DEMO_VERIFICATION_SID";
  } else {
    const otp = generateOTP(); // Generate the OTP
    const phoneNumberWithoutPrefix = pn.startsWith('+91') ? pn.slice(3) : pn; // Remove the +91 prefix
    verificationSid = await sendOTP(phoneNumberWithoutPrefix, otp,req); // Send the OTP without +91
  }

  // Set the referral code to the phone number
  const referralCode = phoneNumber;

  // Create a temporary registration record
  await TempRegistration.create({
    phoneNumber,
    name,
    referralCode, // Use the phone number as referral code
    referredBy,
    state,
    dob,
    verificationSid,
  });

  // Store verification details in session
  req.session.phoneNumber = phoneNumber;
  req.session.verificationSid = verificationSid;

  res.status(201).json({ message: "OTP sent successfully" });
});

// @desc    Complete registration after OTP verification
// @route   POST /api/auth/register/complete
// @access  Public
const completeRegistration = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const { phoneNumber, verificationSid } = req.session;

  console.log(`Session phoneNumber: ${phoneNumber}, verificationSid: ${verificationSid}`);
  console.log(`Received OTP: ${otp}`);

  // Format phoneNumber for OTP verification without +91
  const formattedPhoneNumber = phoneNumber.replace(/^\+91/, '');

  if (formattedPhoneNumber === '9850132687' && otp === '9999') {
    console.log('Demo phone number and OTP detected');
    try {
      const tempReg = await TempRegistration.findOne({ verificationSid, phoneNumber });
      if (!tempReg) {
        console.log('Temp registration not found for demo number');
        return res.status(400).json({ message: "Registration session expired or invalid" });
      }

      const newUser = await EmployeeAuthModel.create({
        phoneNumber: tempReg.phoneNumber,
        name: tempReg.name,
        referralCode: tempReg.phoneNumber,
        state: tempReg.state,
        referredBy: tempReg.referredBy,
        dob: tempReg.dob,
        isCompleted: true,
      });

      const formattedId = generateFormattedId(newUser);
      newUser.formattedId = formattedId;
      await newUser.save();

      await EmployeeInfoModel.create({
        id: newUser._id,
        formattedId: newUser.formattedId,
        referralCode: newUser.referralCode,
        personalInfo: {
          name: newUser.name,
          state: newUser.state,
          phoneNumber: newUser.phoneNumber,
          dob: newUser.dob.toISOString().split('T')[0],
          isCompleted: true,
        },
        referredBy: newUser.referredBy,
      });

      const token = generateToken(phoneNumber, "employee", newUser._id);

      await TempRegistration.deleteOne({ verificationSid });
      req.session.destroy();

      console.log('Demo registration successful');
      return res.status(201).json({
        _id: newUser._id,
        phoneNumber: newUser.phoneNumber,
        name: newUser.name,
        referralCode: newUser.referralCode,
        state: newUser.state,
        dob: newUser.dob.toISOString().split('T')[0],
        formattedId: newUser.formattedId,
        token: token,
      });
    } catch (error) {
      console.log('Error during demo registration:', error.message);
      return res.status(500).json({
        message: "Failed to complete demo registration",
        error: error.message,
      });

    }
  } else {
    console.log('Normal registration process');
    const tempReg = await TempRegistration.findOne({ verificationSid, phoneNumber });
    console.log(phoneNumber);
console.log(formattedPhoneNumber);
    if (!tempReg) {
      console.log('Temp registration not found');
      return res.status(400).json({ message: "Registration session expired or invalid" });
    }

    try {
            console.log("OTP: ",otp);
      const status = await verifyOTP(otp, req.session.otp); // Pass formattedPhoneNumber to verifyOTP
      console.log(`OTP verification status: ${status}`);
      if (status !== "approved") {
        console.log('Invalid or expired OTP');
        return res.status(401).json({ message: "Invalid or expired OTP" });
      }

      const referrer = tempReg.referredBy
        ? await EmployeeInfoModel.findOne({ "personalInfo.phoneNumber": tempReg.referredBy })
        : null;
      console.log(referrer);

      if (tempReg.referredBy && !referrer) {
        return res.status(400).json({ message: "Invalid referral code" });
      }

      const newUser = await EmployeeAuthModel.create({
        phoneNumber: tempReg.phoneNumber,
        name: tempReg.name,
        referralCode: tempReg.phoneNumber,
        state: tempReg.state,
        dob: tempReg.dob,
        isCompleted: true,
        referredBy: referrer ? referrer.personalInfo.phoneNumber : null,
      });

      const formattedId = generateFormattedId(newUser);
      newUser.formattedId = formattedId;
      await newUser.save();

      const newEmployeeInfo = await EmployeeInfoModel.create({
        id: newUser._id,
        formattedId: newUser.formattedId,
        referralCode: newUser.referralCode,
        referredBy: referrer ? referrer.personalInfo.phoneNumber : null,
        personalInfo: {
          name: newUser.name,
          state: newUser.state,
          phoneNumber: newUser.phoneNumber,
          dob: newUser.dob.toISOString().split('T')[0],
          isCompleted: true,
        },
      });

      if (referrer) {
        await EmployeeInfoModel.findByIdAndUpdate(
          referrer._id,
          { $inc: { wallet: 20, totalEarned: 20 } },
          { new: true }
        );

        let referralRecord = await ReferralModel.findOne({ referrerEmployeeId: referrer._id });
        if (!referralRecord) {
          referralRecord = new ReferralModel({
            referrerEmployeeId: referrer._id,
            referees: [],
          });
        }
        referralRecord.referees.push(newEmployeeInfo._id);
        await referralRecord.save();
      }

      const token = generateToken(phoneNumber, "employee", newUser._id);

      await TempRegistration.deleteOne({ verificationSid });
      req.session.destroy();

      res.status(201).json({
        _id: newUser._id,
        phoneNumber: newUser.phoneNumber,
        name: newUser.name,
        referralCode: newUser.referralCode,
        state: newUser.state,
        dob: newUser.dob.toISOString().split('T')[0],
        formattedId: newUser.formattedId,
        token: token,
      });
    } catch (error) {
      console.log('Error during registration:', error.message);
      res.status(500).json({
        message: "Failed to verify OTP or create user",
        error: error.message,
      });
    }
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
  req.session.destroy();
  res.status(201).json({ message: "Logged out successfully" });
};

/*               APIs for admin                    */
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// @desc    get a list of all employees
// @route   GET /user/employee/listOfAllEmployees
// @access  Public
const getAllEmployees = asyncHandler(async (req, res) => {
  try {
    // Fetch all employees from EmployeeInfoModel instead of EmployeeAuthModel
    const employees = await EmployeeInfoModel.find();
    if (employees.length === 0) {
      return res.status(200).json([]); // Return empty array if no employees found
    }

    // Format the data and add additional details
    const formattedEmployees = await Promise.all(
      employees.map(async (employee) => {
        const formattedEmployee = employee.toObject();
        // Get required fields from personalInfo
        formattedEmployee.name = employee.personalInfo?.name || "";
        formattedEmployee.phoneNumber = employee.personalInfo?.phoneNumber || "";
        formattedEmployee.formattedId = employee.formattedId;

        // Format createdAt field
        formattedEmployee.createdAt = formatDate(employee.createdAt);

        // Fetch jobTitle and skills from professionalPreferences
        formattedEmployee.jobTitle = employee.professionalPreferences?.jobTitle || [];
        formattedEmployee.skills = employee.professionalPreferences?.skills || [];

              const authData = await EmployeeAuthModel.findOne({ formattedId: employee.formattedId });
        formattedEmployee.status = authData?.status || "under evaluation"; // Default to "under evaluation" if not found

        return formattedEmployee;
      })
    );

    res.status(200).json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving data", error });
  }
});

const registerUserWithJWT = asyncHandler(async (req, res) => {
  const { phoneNumber: pn, name, referredBy, state, dob: dobStr } = req.body;

  // Format the phone number
  const phoneNumber = formatPhoneNumber(pn);

  // Check if the phone number is already in use
  const existingEmployee = await EmployeeAuthModel.findOne({ phoneNumber });
  if (existingEmployee) {
    res.status(400);
    throw new Error("Phone number already in use");
  }

  // Check if the phone number is already registered but OTP verification is incomplete
  const tempReg = await TempRegistration.findOne({ phoneNumber });
  if (tempReg) {
    res.status(400);
    throw new Error("Phone number already registered, please complete OTP verification");
  }

  // Parse the date of birth
  const dob = parseDate(dobStr);
  if (!dob) {
    res.status(400);
    throw new Error("Invalid date of birth format");
  }

  let verificationSid = null;

  // Skip OTP sending for the demo phone number
  if (phoneNumber === '+919850132687') {
    verificationSid = "DEMO_VERIFICATION_SID";
  } else {
    // Generate the OTP
    const otp = generateOTP();

    // Format phone number to remove +91 prefix
    const phoneNumberWithoutPrefix = pn.startsWith('+91') ? pn.slice(3) : pn;

    // Send OTP without session
    verificationSid = await sendOTPNoSession(phoneNumberWithoutPrefix, otp);
  }

  // Set the referralCode to the phoneNumber
  const referralCode = phoneNumber;

  // Create a temporary registration record
  await TempRegistration.create({
    phoneNumber,
    name,
    referralCode,
    referredBy,
    state,
    dob,
    verificationSid,
  });

         const token = jwt.sign(
    { phoneNumber, verificationSid },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Token expires in 15 minutes
  );

  res.status(201).json({
    message: "OTP sent successfully. Please verify to complete registration.",
          token,
  });
});

const completeRegistrationWithJWT = asyncHandler(async (req, res) => {
  const { otp, token } = req.body;

  try {
    // Verify and decode the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { phoneNumber, verificationSid } = decoded;

    console.log(`Decoded JWT phoneNumber: ${phoneNumber}, verificationSid: ${verificationSid}`);
    console.log(`Received OTP: ${otp}`);

    if (phoneNumber === '+919850132687' && otp === '9999') {
      console.log('Demo phone number and OTP detected');
      try {
        const tempReg = await TempRegistration.findOne({ verificationSid, phoneNumber });
        if (!tempReg) {
          console.log('Temp registration not found for demo number');
          return res.status(400).json({ message: "Registration session expired or invalid" });
        }

        const newUser = await EmployeeAuthModel.create({
          phoneNumber: tempReg.phoneNumber,
          name: tempReg.name,
          referralCode: tempReg.phoneNumber, // Automatically set referralCode
          state: tempReg.state,
          referredBy: tempReg.referredBy,
          dob: tempReg.dob,
          isCompleted: true,
        });

        const formattedId = generateFormattedId(newUser);
        newUser.formattedId = formattedId;
        await newUser.save();

        
        // Create the employee info document with referredBy field
        await EmployeeInfoModel.create({
          id: newUser._id,
          formattedId: newUser.formattedId,
          referralCode: newUser.referralCode,
          personalInfo: {
            name: newUser.name,
            state: newUser.state,
            phoneNumber: newUser.phoneNumber,
            dob: newUser.dob.toISOString().split('T')[0],
            isCompleted: true,
          },
          referredBy: newUser.referredBy
        });

        const authToken = generateToken(phoneNumber, "employee", newUser._id);

        await TempRegistration.deleteOne({ verificationSid });

        console.log('Demo registration successful');
        return res.status(201).json({
          _id: newUser._id,
          phoneNumber: newUser.phoneNumber,
          name: newUser.name,
          referralCode: newUser.referralCode,
          state: newUser.state,
          dob: newUser.dob.toISOString().split('T')[0],
          formattedId: newUser.formattedId,
          token: authToken,
        });
      } catch (error) {
        console.log('Error during demo registration:', error.message);
        return res.status(500).json({
          message: "Failed to complete demo registration",
          error: error.message,
        });
      }
    }  else {

      console.log('Normal registration process');
      const tempReg = await TempRegistration.findOne({ verificationSid, phoneNumber });
      if (!tempReg) {
        console.log('Temp registration not found');
        return res.status(400).json({ message: "Registration session expired or invalid" });
      }

      try {
        // Correcting OTP verification process here
        const storedOtp = await getStoredOTP(phoneNumber);  // Fetch the OTP stored for the phoneNumber
        console.log(`Stored OTP: ${storedOtp}`);

        if (!storedOtp) {
          console.log('OTP not found or expired');
          return res.status(400).json({ message: "OTP not found or expired" });
        }

        // Compare the input OTP with the stored OTP
        if (otp !== storedOtp) {
          console.log('Invalid or expired OTP');
          return res.status(401).json({ message: "Invalid or expired OTP" });
        }

        // Check if the referredBy code matches any existing employee's referralCode
        const referrer = tempReg.referredBy ? await EmployeeInfoModel.findOne({ "personalInfo.phoneNumber": tempReg.referredBy }) : null;
        if (tempReg.referredBy && !referrer) {
          return res.status(400).json({ message: "Invalid referral code" });
        }

        // Create the new user in EmployeeAuthModel with the correct referredBy field
        const newUser = await EmployeeAuthModel.create({
          phoneNumber: tempReg.phoneNumber,
          name: tempReg.name,
          referralCode: tempReg.phoneNumber, // Automatically set referralCode
          state: tempReg.state,
          dob: tempReg.dob,
          isCompleted: true,
          referredBy: referrer ? referrer.personalInfo.phoneNumber : null, // Set referredBy field correctly
        });

        const formattedId = generateFormattedId(newUser);
        newUser.formattedId = formattedId;
        await newUser.save();

        // Create the employee info document in EmployeeInfoModel
        const newEmployeeInfo = await EmployeeInfoModel.create({
          id: newUser._id,
          formattedId: newUser.formattedId,
          referralCode: newUser.referralCode,
          referredBy: referrer ? referrer.personalInfo.phoneNumber : null, // Ensure referredBy is set correctly
          personalInfo: {
            name: newUser.name,
            state: newUser.state,
            phoneNumber: newUser.phoneNumber,
            dob: newUser.dob.toISOString().split('T')[0],
            isCompleted: true,
          },
        });

        // Update the referrer's wallet and totalEarned balance if referrer exists
        if (referrer) {
          await EmployeeInfoModel.findByIdAndUpdate(
            referrer._id,
            { $inc: { wallet: 20, totalEarned: 20 } }, // Increment wallet and totalEarned by 20
            { new: true }
          );

          // Create or update the referral model
          let referralRecord = await ReferralModel.findOne({ referrerEmployeeId: referrer._id });

          if (!referralRecord) {
            referralRecord = new ReferralModel({
              referrerEmployeeId: referrer._id,
              referees: [],
            });
          }

          referralRecord.referees.push(newEmployeeInfo._id);
          await referralRecord.save();
        }

        const authToken = generateToken(phoneNumber, "employee", newUser._id);

        await TempRegistration.deleteOne({ verificationSid });

        res.status(201).json({
          _id: newUser._id,
          phoneNumber: newUser.phoneNumber,
          name: newUser.name,
          referralCode: newUser.referralCode,
          state: newUser.state,
          dob: newUser.dob.toISOString().split('T')[0],
          formattedId: newUser.formattedId,
          token: authToken,
        });
      } catch (error) {
        console.log('Error during registration:', error.message);
        res.status(500).json({
          message: "Failed to verify OTP or create user",
          error: error.message,
        });
      }
    }
  } catch (error) {
    console.log('Error verifying JWT or processing registration:', error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});



// @desc    get an employee profile
// @route   GET /user/employee/:employeeId
// @access  Public
const getEmployeeProfile = asyncHandler(async (req, res) => {
  const { formattedId } = req.params;

  console.log(`Received formattedId: ${formattedId}`);

  try {
    // Find the employee using formattedId
    const employeeInfo = await EmployeeInfoModel.findOne({ formattedId });

    if (!employeeInfo) {
      console.log(`Employee not found for formattedId: ${formattedId}`);
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employeeId = employeeInfo.id; // Changed from `_id` to `id`

    // Calculate age and update the age field
    if (employeeInfo.personalInfo?.dob) {
      employeeInfo.age = calculateAge(employeeInfo.personalInfo.dob);
    }

    // Fetch additional employee documents
    const employeeDocument = await EmployeeInfoModel.findOne({ id: employeeId });
    const employeeAuth = await EmployeeAuthModel.findOne({ id: employeeId }); // Changed from `_id` to `id`

    // Safely assign document statuses if employeeDocument exists
   if (employeeDocument) {
  employeeInfo.documents = employeeInfo.documents || [];

  for (const document of employeeInfo.documents) {
    if (document.isCompleted) {
      // Generate signed URL for front photo if filename exists
      if (document.front?.filename) {
        document.front.uri = await generateV4ReadSignedUrl(employeeId, document.front.filename);
        console.log(`Generated signed URL for front photo of ${document.type}: ${document.front.uri}`);
      }

      // Generate signed URL for back photo if filename exists
      if (document.back?.filename) {
        document.back.uri = await generateV4ReadSignedUrl(employeeId, document.back.filename);
        console.log(`Generated signed URL for back photo of ${document.type}: ${document.back.uri}`);
      }
    }
  }
}

if (employeeAuth) {
  employeeInfo.phoneNumber = employeeAuth.phoneNumber ?? null; // Safely assign phone number
}

// Generate signed URL for facePhoto if it exists and is completed
const facePhoto = employeeInfo.facePhoto; // Accessing facePhoto directly from employeeInfo
if (facePhoto && facePhoto.isCompleted && facePhoto.filename) {
  facePhoto.uri = await generateV4ReadSignedUrl(employeeId, facePhoto.filename);
  console.log(`Generated signed URL for face photo: ${facePhoto.uri}`);
} else if (facePhoto && facePhoto.isCompleted) {
  console.log(`Face photo filename missing for employeeId: ${employeeId}`);
}


    // Reformat DOB if exists
    if (employeeInfo.personalInfo?.dob) {
      const dob = new Date(employeeInfo.personalInfo.dob);
      const day = String(dob.getDate()).padStart(2, '0');
      const month = String(dob.getMonth() + 1).padStart(2, '0');
      const year = dob.getFullYear();
      employeeInfo.personalInfo.dob = `${day}-${month}-${year}`;
    }

    // Step 1: Get job applications by this employee using the `id` field
    const jobApplications = await jobPostApplicationsModel.find({ employeeId }).select('adId status createdAt');

    // Step 2: Fetch job post details for each application
    const applicationsWithJobDetails = await Promise.all(
      jobApplications.map(async (application) => {
        const jobPost = await JobPost.findById(application.adId).select('designation companyId requiredEmployees location');

        // Safely handle missing jobPost or companyId
        if (!jobPost || !jobPost.companyId) {
          console.error(`Invalid jobPost or missing companyId for adId: ${application.adId}`);
          return {
            adId: application.adId,
            designation: jobPost?.designation || 'Unknown Designation',
            companyName: 'Unknown Company',
            requiredEmployees: jobPost?.requiredEmployees ?? 0,
            location: jobPost?.location || 'Unknown Location',
            status: application.status,
            appliedAt: application.createdAt,
          };
        }

        // Fetch company name manually using companyId
        const company = await Company.findById(jobPost.companyId).select('companyprofile.businessname');
        const companyName = company?.companyprofile?.businessname || 'Unknown Company';

        return {
          adId: application.adId,
          designation: jobPost?.designation || 'Unknown Designation',
          companyName: companyName,
          requiredEmployees: jobPost?.requiredEmployees ?? 0,
          location: jobPost?.location || 'Unknown Location',
          status: application.status,
          appliedAt: application.createdAt,
        };
      })
    );
         const aadhaarVerification = await AadhaarVerification.findOne({ userId: employeeId });
 const bankDetails = await employeeBankAccountDetails.find({ employeeId }).select(
      'accountNumber accountHolderName ifscCode upiId'
    );

    // Step 3: Include applications with job post details in the response
    res.status(200).json({
      employeeInfo,
      applications: applicationsWithJobDetails,
            aadhaarVerification: aadhaarVerification || null,
            bankDetails: bankDetails || [],
    });
  } catch (error) {
    console.error(`Error retrieving employee info for formattedId: ${formattedId}`, error);
    res.status(500).json({ message: 'Error retrieving employee info', error });
  }
});

// @desc    Update the hiring status of an employee
// @route   PUT /user/employee/status/:employeeId
// @access  Public
const getEmployeeProfileById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log(`Received employeeId: ${id}`);

  try {
    const employeeInfo = await EmployeeInfoModel.findOne({ id: id });

    if (!employeeInfo) {
      console.log(`Employee not found for employeeId: ${id}`);
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log(`Found employee info: ${JSON.stringify(employeeInfo, null, 2)}`);

    // Calculate age and update the age field
    if (employeeInfo.personalInfo.dob) {
      employeeInfo.age = calculateAge(employeeInfo.personalInfo.dob);
      console.log(`Calculated age: ${employeeInfo.age}`);
    }

    const employeeDocument = await EmployeeDocModel.findOne({ id: id });
    console.log(`Found employee documents: ${JSON.stringify(employeeDocument, null, 2)}`);

    const employeeAuth = await EmployeeAuthModel.findOne({ _id: id });
    console.log(`Found employee auth info: ${JSON.stringify(employeeAuth, null, 2)}`);

    if (employeeDocument) {
      // Assuming employeeDocument has the same structure as employeeInfo.documents
      const updatedDocuments = employeeInfo.documents.map(doc => {
        const matchingDoc = employeeDocument.documents.find(d => d.type === doc.type);
        if (matchingDoc) {
          return { ...doc, isCompleted: matchingDoc.isCompleted };
        }
        return doc;
      });
      employeeInfo.documents = updatedDocuments;
      console.log(`Updated document completion status`);
    }

    if (employeeAuth) {
      employeeInfo.phoneNumber = employeeAuth.phoneNumber;
      console.log(`Updated phone number: ${employeeInfo.phoneNumber}`);
    }

    // Generate signed URL for facePhoto if it exists
    if (employeeInfo.facePhoto && employeeInfo.facePhoto.filename) {
      const signedUrl = await generateV4ReadSignedUrl(id, employeeInfo.facePhoto.filename);
      employeeInfo.facePhoto.uri = signedUrl;
      console.log(`Generated signed URL for face photo: ${signedUrl}`);
    }

    // Format the date of birth
    if (employeeInfo.personalInfo.dob) {
      const dob = new Date(employeeInfo.personalInfo.dob);
      const day = String(dob.getDate()).padStart(2, '0');
      const month = String(dob.getMonth() + 1).padStart(2, '0');
      const year = dob.getFullYear();
      employeeInfo.personalInfo.dob = `${day}-${month}-${year}`;
      console.log(`Formatted DOB: ${employeeInfo.personalInfo.dob}`);
    }

    console.log(`Final employee info to be sent: ${JSON.stringify(employeeInfo, null, 2)}`);
    res.status(200).json(employeeInfo);
  } catch (error) {
    console.error(`Error retrieving employee info for employeeId: ${id}`, error);
    res.status(500).json({ message: 'Error retrieving employee info', error });
  }
});

const updateHiringStatus = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { status } = req.query;

  console.log(`Updating hiring status for employeeId: ${employeeId} to ${status}`);

  if (!['shortlisted', 'hired', 'rejected', 'applied'].includes(status)) {
    return res.status(400).json({ message: 'Invalid hiring status' });
  }

  try {
    const employeeInfo = await EmployeeInfoModel.findOneAndUpdate(
      { id: employeeId },
      { hiringStatus: status },
      { new: true }
    );

    if (!employeeInfo) {
      console.log(`Employee not found for id: ${employeeId}`);
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json({ message: `Employee's hiring status successfully updated to ${status}`, employeeInfo });
  } catch (error) {
    console.error(`Error updating hiring status for id: ${employeeId}`, error);
    res.status(500).json({ message: 'Error updating hiring status', error });
  }
});

// @desc    update an employee's verification status
// @route   PUT /user/employee/:employeeId
// @access  Public
const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { status } = req.query;

  if (!['approved', 'rejected', 'under evaluation'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const updatedEmployeeStatus = await EmployeeAuthModel.findByIdAndUpdate(
      employeeId,
      { status },
      { new: true }
    );

    if (!updatedEmployeeStatus) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json(updatedEmployeeStatus);
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error });
  }
});

// @desc    Get an employee document
// @route   GET /employee/doc/:employeeId
// @access  Public
const getEmployeeDocument = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  console.log(`Received employeeId: ${employeeId}`);

  try {
    const employeeDoc = await Document.findOne({ id: employeeId });

    if (!employeeDoc) {
      console.log(`Employee document not found for id: ${employeeId}`);
      return res.status(404).json({ message: 'Employee document not found' });
    }

    res.status(200).json(employeeDoc);
  } catch (error) {
    console.error(`Error retrieving employee document for id: ${employeeId}`, error);
    res.status(500).json({ message: 'Error retrieving employee document', error });
  }
});

// @desc    delete an employee
// @route   DELETE /user/employee/:employeeId
// @access  Public[INFO] Searching for EmployeeInfo with _id: 67580dc8651fb985aba50065
const deleteEmployee = async (req, res) => {
  const { employeeId } = req.params;

  console.log(`[INFO] Received request to delete employee with ID: ${employeeId}`);

  try {
    // Step 1: Find the EmployeeInfo record using _id
    console.log(`[INFO] Searching for EmployeeInfo with _id: ${employeeId}`);
    const employeeInfo = await EmployeeInfoModel.findOne({ _id: employeeId });

    if (!employeeInfo) {
      console.log(`[WARN] EmployeeInfo not found for _id: ${employeeId}`);
      return res.status(404).json({ message: 'EmployeeInfo not found' });
    }

    console.log(`[INFO] Found EmployeeInfo: ${JSON.stringify(employeeInfo)}`);

    // Step 2: Extract the formattedId from EmployeeInfo
    const { formattedId } = employeeInfo;

    if (!formattedId) {
      console.log(`[ERROR] Missing formattedId in EmployeeInfo: ${JSON.stringify(employeeInfo)}`);
      return res.status(400).json({ message: 'Formatted ID is missing in EmployeeInfo' });
    }

    console.log(`[INFO] Found formattedId: ${formattedId}`);

    // Step 3: Use formattedId to delete the record in EmployeeAuthModel
    console.log(`[INFO] Deleting EmployeeAuth record with formattedId: ${formattedId}`);
    const deletedEmployeeAuth = await EmployeeAuthModel.findOneAndDelete({ formattedId });

    if (!deletedEmployeeAuth) {
      console.log(`[WARN] EmployeeAuth not found for formattedId: ${formattedId}`);
    } else {
      console.log(`[INFO] Deleted EmployeeAuth record: ${JSON.stringify(deletedEmployeeAuth)}`);
    }

    // Step 4: Delete the EmployeeInfo record
    console.log(`[INFO] Deleting EmployeeInfo record with _id: ${employeeId}`);
    const deletedEmployeeInfo = await EmployeeInfoModel.findOneAndDelete({ _id: employeeId });

    if (!deletedEmployeeInfo) {
      console.log(`[ERROR] Failed to delete EmployeeInfo with _id: ${employeeId}`);
      return res.status(404).json({ message: 'Failed to delete EmployeeInfo' });
    }

    console.log(`[INFO] Deleted EmployeeInfo record: ${JSON.stringify(deletedEmployeeInfo)}`);

    res.status(200).json({ message: 'Employee and associated info deleted successfully' });
  } catch (error) {
    console.error(`[ERROR] An error occurred while deleting employee with ID: ${employeeId}`, error);
    res.status(500).json({ message: 'Error deleting employee and associated info', error: error.message });
  }
};

const getAllSignupsCounts = async (req, res) => {
  try {
      // Current time
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneDayAgo = new Date(startOfToday);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const oneWeekAgo = new Date(startOfToday);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const twoWeeksAgo = new Date(startOfToday);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const oneMonthAgo = new Date(startOfToday);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const twoMonthsAgo = new Date(startOfToday);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const threeMonthsAgo = new Date(startOfToday);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const sixMonthsAgo = new Date(startOfToday);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const oneYearAgo = new Date(startOfToday);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Get counts for employee signups
      const [
          dailyCount,
          weeklyCount,
          previousWeeklyCount,
          monthlyCount,
          previousMonthlyCount,
          threeMonthsCount,
          sixMonthsCount,
            yearlyCount
        ] = await Promise.all([
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: oneDayAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: twoMonthsAgo, $lt: oneMonthAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: threeMonthsAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: sixMonthsAgo } }),
            EmployeeAuthModel.countDocuments({ createdAt: { $gte: oneYearAgo } })
        ]);

        // Calculate growth percentages
        const weeklyGrowth = previousWeeklyCount > 0 ? ((weeklyCount - previousWeeklyCount) / previousWeeklyCount) * 100 : 0;
        const monthlyGrowth = previousMonthlyCount > 0 ? ((monthlyCount - previousMonthlyCount) / previousMonthlyCount) * 100 : 0;
        const threeMonthsGrowth = threeMonthsCount > 0 ? ((threeMonthsCount - sixMonthsCount) / sixMonthsCount) * 100 : 0;
        const sixMonthsGrowth = sixMonthsCount > 0 ? ((sixMonthsCount - yearlyCount) / yearlyCount) * 100 : 0;
        const yearlyGrowth = yearlyCount > 0 ? (yearlyCount / yearlyCount) * 100 : 0;


        // Get counts for document submissions
        const facePhotoOnlyCounts = {
            current: await EmployeeInfoModel.countDocuments({
                'facePhoto.uri': { $ne: null, $ne: '' },
                $or: [
                    { 'documents.aadhaarNumber': { $exists: false } },
                    { 'documents.aadhaarNumber': { $eq: '' } }
                ]
            }),
            oneMonthAgo: await EmployeeInfoModel.countDocuments({
              'facePhoto.uri': { $ne: null, $ne: '' },
                createdAt: { $gte: oneMonthAgo, $lt: startOfToday },
                $or: [
                    { 'documents.aadhaarNumber': { $exists: false } },
                    { 'documents.aadhaarNumber': { $eq: '' } }
                ]
            }),
            threeMonthsAgo: await EmployeeInfoModel.countDocuments({
                'facePhoto.uri': { $ne: null, $ne: '' },
                createdAt: { $gte: threeMonthsAgo, $lt: startOfToday },
                $or: [
                    { 'documents.aadhaarNumber': { $exists: false } },
                    { 'documents.aadhaarNumber': { $eq: '' } }
                ]
            }),
            sixMonthsAgo: await EmployeeInfoModel.countDocuments({
                'facePhoto.uri': { $ne: null, $ne: '' },
                createdAt: { $gte: sixMonthsAgo, $lt: startOfToday },
                $or: [
                    { 'documents.aadhaarNumber': { $exists: false } },
                    { 'documents.aadhaarNumber': { $eq: '' } }
                ]
            }),
            oneYearAgo: await EmployeeInfoModel.countDocuments({
                'facePhoto.uri': { $ne: null, $ne: '' },
                createdAt: { $gte: oneYearAgo, $lt: startOfToday },
                $or: [
                    { 'documents.aadhaarNumber': { $exists: false } },
                    { 'documents.aadhaarNumber': { $eq: '' } }
                ]
            })
        };

        const aadhaarOnlyCounts = {
            current: await EmployeeInfoModel.countDocuments({
                'documents.aadhaarNumber': { $ne: null, $ne: '' },
                $or: [
                    { 'facePhoto.uri': { $exists: false } },
                    { 'facePhoto.uri': { $eq: '' } }
                  ]
                }),
                oneMonthAgo: await EmployeeInfoModel.countDocuments({
                    'documents.aadhaarNumber': { $ne: null, $ne: '' },
                    createdAt: { $gte: oneMonthAgo, $lt: startOfToday },
                    $or: [
                        { 'facePhoto.uri': { $exists: false } },
                        { 'facePhoto.uri': { $eq: '' } }
                    ]
                }),
                threeMonthsAgo: await EmployeeInfoModel.countDocuments({
                    'documents.aadhaarNumber': { $ne: null, $ne: '' },
                    createdAt: { $gte: threeMonthsAgo, $lt: startOfToday },
                    $or: [
                        { 'facePhoto.uri': { $exists: false } },
                        { 'facePhoto.uri': { $eq: '' } }
                    ]
                }),
                sixMonthsAgo: await EmployeeInfoModel.countDocuments({
                    'documents.aadhaarNumber': { $ne: null, $ne: '' },
                    createdAt: { $gte: sixMonthsAgo, $lt: startOfToday },
                    $or: [
                        { 'facePhoto.uri': { $exists: false } },
                        { 'facePhoto.uri': { $eq: '' } }
                    ]
                }),
                oneYearAgo: await EmployeeInfoModel.countDocuments({
                    'documents.aadhaarNumber': { $ne: null, $ne: '' },
                    createdAt: { $gte: oneYearAgo, $lt: startOfToday },
                    $or: [
                        { 'facePhoto.uri': { $exists: false } },
                        { 'facePhoto.uri': { $eq: '' } }
                    ]
                })
            };

            const bothCounts = {
              current: await EmployeeInfoModel.countDocuments({
                  'facePhoto.uri': { $ne: null, $ne: '' },
                  'documents.aadhaarNumber': { $ne: null, $ne: '' }
              }),
              oneMonthAgo: await EmployeeInfoModel.countDocuments({
                  'facePhoto.uri': { $ne: null, $ne: '' },
                  'documents.aadhaarNumber': { $ne: null, $ne: '' },
                  createdAt: { $gte: oneMonthAgo, $lt: startOfToday }
              }),
              threeMonthsAgo: await EmployeeInfoModel.countDocuments({
                  'facePhoto.uri': { $ne: null, $ne: '' },
                  'documents.aadhaarNumber': { $ne: null, $ne: '' },
                  createdAt: { $gte: threeMonthsAgo, $lt: startOfToday }
              }),
              sixMonthsAgo: await EmployeeInfoModel.countDocuments({
                  'facePhoto.uri': { $ne: null, $ne: '' },
                  'documents.aadhaarNumber': { $ne: null, $ne: '' },
                  createdAt: { $gte: sixMonthsAgo, $lt: startOfToday }
              }),
              oneYearAgo: await EmployeeInfoModel.countDocuments({
                  'facePhoto.uri': { $ne: null, $ne: '' },
                  'documents.aadhaarNumber': { $ne: null, $ne: '' },
                  createdAt: { $gte: oneYearAgo, $lt: startOfToday }
              })
          };
  
              const calculateGrowth = (current, previous) => (previous > 0 ? ((current - previous) / previous) * 100 : 0);
  
              const documentGrowth = {
              facePhotoOnly: {
                  monthly: calculateGrowth(facePhotoOnlyCounts.current, facePhotoOnlyCounts.oneMonthAgo),
                  threeMonths: calculateGrowth(facePhotoOnlyCounts.current, facePhotoOnlyCounts.threeMonthsAgo),
                  sixMonths: calculateGrowth(facePhotoOnlyCounts.current, facePhotoOnlyCounts.sixMonthsAgo),
                  yearly: calculateGrowth(facePhotoOnlyCounts.current, facePhotoOnlyCounts.oneYearAgo)
            },
            aadhaarOnly: {
                monthly: calculateGrowth(aadhaarOnlyCounts.current, aadhaarOnlyCounts.oneMonthAgo),
                threeMonths: calculateGrowth(aadhaarOnlyCounts.current, aadhaarOnlyCounts.threeMonthsAgo),
                sixMonths: calculateGrowth(aadhaarOnlyCounts.current, aadhaarOnlyCounts.sixMonthsAgo),
                yearly: calculateGrowth(aadhaarOnlyCounts.current, aadhaarOnlyCounts.oneYearAgo)
            },
            both: {
                monthly: calculateGrowth(bothCounts.current, bothCounts.oneMonthAgo),
                threeMonths: calculateGrowth(bothCounts.current, bothCounts.threeMonthsAgo),
                sixMonths: calculateGrowth(bothCounts.current, bothCounts.sixMonthsAgo),
                yearly: calculateGrowth(bothCounts.current, bothCounts.oneYearAgo)
            }
        };

        // Get counts for business account signups
        const currentDate = new Date();
        const dayDate = new Date(currentDate);
        dayDate.setDate(dayDate.getDate() - 1);

        const monthDate = new Date(currentDate);
        monthDate.setMonth(monthDate.getMonth() - 1);

        const threeMonthsDate = new Date(currentDate);
        threeMonthsDate.setMonth(threeMonthsDate.getMonth() - 3);

        const sixMonthsDate = new Date(currentDate);
        sixMonthsDate.setMonth(sixMonthsDate.getMonth() - 6);

        const yearDate = new Date(currentDate);
        yearDate.setFullYear(yearDate.getFullYear() - 1);

        const lastWeekDate = new Date(currentDate);
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);

        const lastMonthDate = new Date(currentDate);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

            const previousWeeklyBusinessCount = await BusinessAccount.countDocuments({
    createdAt: { $gte: lastWeekDate, $lt: dayDate }
});
const previousMonthlyBusinessCount = await BusinessAccount.countDocuments({
    createdAt: { $gte: lastMonthDate, $lt: monthDate }
});
const previousThreeMonthsBusinessCount = await BusinessAccount.countDocuments({
    createdAt: { $gte: sixMonthsDate, $lt: threeMonthsDate }
});
const previousSixMonthsBusinessCount = await BusinessAccount.countDocuments({
    createdAt: { $gte: yearDate, $lt: sixMonthsDate }
});

const [
  dayCount,
  businessMonthCount,
  businessThreeMonthsCount,
  businessSixMonthsCount,
  businessYearCount,
  lastWeekCount,
  lastMonthCount
] = await Promise.all([
  BusinessAccount.countDocuments({ createdAt: { $gte: dayDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: monthDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: threeMonthsDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: sixMonthsDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: yearDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: lastWeekDate } }),
  BusinessAccount.countDocuments({ createdAt: { $gte: lastMonthDate } })
]);

const weekOnWeekGrowth = lastWeekCount > 0 ? ((dayCount - lastWeekCount) / lastWeekCount) * 100 : 0;
const monthOnMonthGrowth = lastMonthCount > 0 ? ((businessMonthCount - lastMonthCount) / lastMonthCount) * 100 : 0;

const businessGrowth = {
weeklyGrowth: parseFloat(calculateGrowth(dayCount, previousWeeklyBusinessCount).toFixed(2)),
monthlyGrowth: parseFloat(calculateGrowth(businessMonthCount, previousMonthlyBusinessCount).toFixed(2)),
threeMonthsBGrowth: parseFloat(calculateGrowth(businessThreeMonthsCount, previousThreeMonthsBusinessCount).toFixed(2)),
sixMonthsBGrowth: parseFloat(calculateGrowth(businessSixMonthsCount, previousSixMonthsBusinessCount).toFixed(2)),
yearlyBGrowth: parseFloat(calculateGrowth(businessYearCount, 0).toFixed(2)) // Yearly growth with no previous year for comparison
};
// Company-related counts
const dailyCompanyCount = await Company.countDocuments({ createdAt: { $gte: oneDayAgo } });
const weeklyCompanyCount = await Company.countDocuments({ createdAt: { $gte: oneWeekAgo } });
        const previousWeeklyCompanyCount = await Company.countDocuments({
            createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo }
        });
        const monthlyCompanyCount = await Company.countDocuments({ createdAt: { $gte: oneMonthAgo } });
        const previousMonthlyCompanyCount = await Company.countDocuments({
            createdAt: { $gte: twoMonthsAgo, $lt: oneMonthAgo }
        });
        const threeMonthsCompanyCount = await Company.countDocuments({ createdAt: { $gte: threeMonthsAgo } });
        const sixMonthsCompanyCount = await Company.countDocuments({ createdAt: { $gte: sixMonthsAgo } });
        const yearlyCompanyCount = await Company.countDocuments({ createdAt: { $gte: oneYearAgo } });

            const companyGrowth = {
            weeklyGrowth: parseFloat(calculateGrowth(weeklyCompanyCount, previousWeeklyCompanyCount).toFixed(2)),
            monthlyGrowth: parseFloat(calculateGrowth(monthlyCompanyCount, previousMonthlyCompanyCount).toFixed(2)),
            threeMonthsGrowth: parseFloat(calculateGrowth(threeMonthsCompanyCount, sixMonthsCompanyCount).toFixed(2)),
            sixMonthsGrowth: parseFloat(calculateGrowth(sixMonthsCompanyCount, yearlyCompanyCount).toFixed(2)),
            yearlyGrowth: parseFloat(calculateGrowth(yearlyCompanyCount, 0).toFixed(2))
        };

        // Consolidated response
        res.status(200).json({
            employeeSignups: {
                dailyCount,
                weeklyCount,
                monthlyCount,
                threeMonthsCount,
                sixMonthsCount,
                yearlyCount,
                    growth: {
                    weeklyGrowth: parseFloat(weeklyGrowth.toFixed(2)),
                    monthlyGrowth: parseFloat(monthlyGrowth.toFixed(2)),
                    threeMonthsGrowth: parseFloat(threeMonthsGrowth.toFixed(2)),
                    sixMonthsGrowth: parseFloat(sixMonthsGrowth.toFixed(2)),
                    yearlyGrowth: parseFloat(yearlyGrowth.toFixed(2))
                }
            },
            documentSubmissions: {
                counts: { facePhotoOnlyCounts, aadhaarOnlyCounts, bothCounts },
                growth: documentGrowth
            },
            businessSignups: {
                dayCount,
                monthCount: businessMonthCount,
                threeMonthsCount: businessThreeMonthsCount,
                sixMonthsCount: businessSixMonthsCount,
                yearCount: businessYearCount,
                weekOnWeekGrowth: parseFloat(weekOnWeekGrowth.toFixed(2)),
                monthOnMonthGrowth: parseFloat(monthOnMonthGrowth.toFixed(2)),
                threeMonth:businessGrowth.threeMonthsBGrowth,
                sixMonth: businessGrowth.sixMonthsBGrowth,
                yearly: businessGrowth.yearlyBGrowth
            },
                companySignups: {
                dailyCount: dailyCompanyCount,
                weeklyCount: weeklyCompanyCount,
                monthlyCount: monthlyCompanyCount,
                threeMonthsCount: threeMonthsCompanyCount,
                sixMonthsCount: sixMonthsCompanyCount,
                yearlyCount: yearlyCompanyCount,
                growth: companyGrowth
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving counts", error: error.message });
      }
    };




export {
  loginUser,
  completeLogin,
  registerUser,
  completeRegistration,
  logoutUser,
  getAllEmployees,
  getEmployeeProfile,
  updateHiringStatus,
  getEmployeeDocument,
  updateEmployeeStatus,
  deleteEmployee,
  getEmployeeProfileById,
  completeRegistrationWithJWT,
  registerUserWithJWT,
  getAllSignupsCounts
};