import Admin from '../../models/admin/admin.model.js';
import TempAdminRegistration from '../../models/admin/adminTempRegistration.model.js';
import asyncHandler from "../../handlers/asyncHandler.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {generateToken, generateTempToken, verifyTempToken}  from "../../utils/generateToken.js";
import {
    formatPhoneNumber,
    parseDate,
} from '../../handlers/utilsHandler.js';
import { sendOTP, verifyOTP,sendOTPNoSession , verifyOTPNoSession } from "../../utils/otpService.js";
import { sendNotification,createNotification, sendPushNotification } from '../../utils/notificationUtils.js';
import EmployeeInfoModel from "../../models/employee/EmployeeInfo.model.js";
import Notification from '../../models/notification.model.js';
import BusinessAccount from "../../models/business/businessAccount.model.js";
import Company from "../../models/company.model.js";
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
    return `ADMIN-${xx}${yy}-${zzzz}`;
}

const generateOTP = () => {
    // Generate a random 4-digit number
    const otp = Math.floor(1000 + Math.random() * 9000);
    return otp.toString(); // Convert it to a string if needed
  };
  
  const storeFcmToken = async (req, res) => {
    try {
      const { fcmToken } = req.body;
      const userId = req.adminId;
  console.log(`Received FCM token: ${fcmToken} for admin ID: ${userId}`);
  
      if (!fcmToken) {
        return res.status(400).json({ message: 'FCM token is required' });
      }
  
      // Update or create the user's FCM token in the database
      const updateResult = await Admin.updateOne(
        { id: userId },
        { fcmToken }
      );
  
      if (updateResult.nModified === 0) {
        return res.status(404).json({ message: 'Admin not found' });
      }
  
      res.status(200).json({ message: 'FCM token stored successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error storing FCM token', error: error.message });
    }
  };

  // @desc    Register a new admin user
// @route   POST /api/admin/register
// @access  Public
const registerAdminUser = asyncHandler(async (req, res, next) => {
    try {
        const { email, password: plainPassword, phoneNumber: pn, name, role, createdBy } = req.body;

        const formattedPhoneNumber = formatPhoneNumber(pn);
        const localPhoneNumber = pn.startsWith('0') ? pn.slice(1) : pn;

        // Check if the email or phone number is already in use
        const existingAdmin = await Admin.findOne({ $or: [{ phoneNumber: formattedPhoneNumber }, { email }] });
        if (existingAdmin) {
            res.status(400);
            throw new Error("Email or phone number already in use");
        }

        // Generate OTP
        const otp = generateOTP();

        // Send OTP using the non-session-based function
        await sendOTPNoSession(localPhoneNumber, otp);

        // Store OTP in TempAdminRegistration model
        const tempAdmin = await TempAdminRegistration.create({
            phoneNumber: formattedPhoneNumber,
            email,
            name,
            password: plainPassword,
            createdBy,
            role,
            otp,  // Store OTP directly in the database
        });

        // Generate a temporary token to send back
        const tempToken = generateTempToken({ phoneNumber: formattedPhoneNumber, otp }, '10m'); // Example of 10 minutes expiration

        // Send the response
        res.status(201).json({
            message: "OTP sent successfully. Please verify to complete registration.",
            tempToken, // Send the temporary token in the response
        });
    } catch (err) {
        console.error("Error in registerAdminUser:", err.message);
        res.status(500);
        next(err);
    }
});


const completeAdminRegistration = asyncHandler(async (req, res, next) => {
    try {
        const { otp, tempToken } = req.body;

        console.log("Starting completeAdminRegistration..."); // Initial log
        console.log("Received OTP:", otp);
        console.log("Received tempToken:", tempToken);

        // Verify the temporary token and extract the payload
        const decoded = verifyTempToken(tempToken);
        if (!decoded) {
            console.log("Token verification failed: Invalid or expired temporary token");
            return res.status(401).json({ message: "Invalid or expired temporary token" });
        }

        const { phoneNumber, verificationSid } = decoded;
        console.log("Token verified successfully. Decoded data:", decoded);

        // Find the temporary registration record
        const tempReg = await TempAdminRegistration.findOne({ verificationSid, phoneNumber });
        if (!tempReg) {
            console.log("Temporary registration record not found for:", { verificationSid, phoneNumber });
            return res.status(400).json({ message: "Registration session expired or invalid" });
        }

        console.log("Temporary registration record found:", tempReg);

        // Verify OTP against the one stored in the TempAdminRegistration
        console.log("Stored OTP:", tempReg.otp);
        if (otp !== tempReg.otp) {
            console.log("OTP verification failed. Provided OTP does not match stored OTP.");
            return res.status(401).json({ message: "Invalid or expired OTP" });
        }

        console.log("OTP verified successfully.");

        // Generate a unique ID for the new admin
        const formattedId = generateFormattedId();
        console.log("Generated formatted ID:", formattedId);

        // Create the new admin user
        const newAdmin = await Admin.create({
            phoneNumber: tempReg.phoneNumber,
            email: tempReg.email,
            name: tempReg.name,
            role: tempReg.role,
            password: tempReg.password,
            UUID: formattedId,
            createdBy: tempReg.createdBy,
        });

        console.log("New admin created successfully:", newAdmin);
        // Generate the final token
        const token = generateToken(phoneNumber, tempReg.role, newAdmin._id);
        console.log("Generated final token:", token);

        // Delete the temporary registration record
        await TempAdminRegistration.deleteOne({ verificationSid });
        console.log("Temporary registration record deleted.");

        res.status(201).json({
            _id: newAdmin._id,
            phoneNumber: newAdmin.phoneNumber,
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role,
            UUID: newAdmin.UUID,
            token: token,
        });
    } catch (err) {
        console.error("Error during admin registration completion:", err.message);
        res.status(500);
        next(err);
    }
});

const editAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email, phoneNumber, name, role, password } = req.body;

    try {
        // Find the admin by ID
        const admin = await Admin.findById(id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Update admin details
        if (email) admin.email = email;
        if (phoneNumber) admin.phoneNumber = formatPhoneNumber(phoneNumber); // Assuming you have a phone number formatting function
        if (name) admin.name = name;
        if (role) admin.role = role; // Update roles (ensure this is an array)

        // Update password if provided
        if (password) admin.password = password; // Middleware will hash it

        // Save the updated admin
        const updatedAdmin = await admin.save();

        res.status(200).json({
            _id: updatedAdmin._id,
            email: updatedAdmin.email,
            phoneNumber: updatedAdmin.phoneNumber,
            name: updatedAdmin.name,
            role: updatedAdmin.role,
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating admin", error: err.message });
    }
});



// @desc    Authenticate admin user & get token
// @route   POST /api/admin/login
// @access  Public
const loginAdminUser = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user exists
        const user = await Admin.findOne({ email });
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
        console.error("Error in loginAdminUser:", err.message);

        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
    }
});

// @desc    Complete login after OTP verification
// @route   POST /api/admin/login/complete
// @access  Public
const completeAdminLogin = asyncHandler(async (req, res) => {
    try {
        const { otp, tempToken } = req.body;

        // Verify the temporary token and extract the payload
        const decoded = verifyTempToken(tempToken);
        if (!decoded) {
            console.error("Invalid or expired temporary token");
            return res.status(401).json({ message: "Invalid or expired temporary token" });
        }

        // Destructure phoneNumber and format it
        let { phoneNumber, verificationSid, otp: tokenOtp } = decoded;
        phoneNumber = `+91${phoneNumber}`; // Ensure the phone number is in the correct format

        // Log the phone number being searched
        console.log(`Searching for user with phone number: ${phoneNumber}`);

        // Find user based on phone number
        const user = await Admin.findOne({ phoneNumber });
        if (!user) {
            console.log(`User not found for phone number: ${phoneNumber}`);
            return res.status(404).json({ message: "User not found" });
        }

        // Log user found
        console.log(`User found: ${JSON.stringify(user)}`);

        // Verify OTP
        const status = await verifyOTP(otp, tokenOtp);
        console.log(`OTP verification status for phone number ${phoneNumber}: ${status}`);
        if (status !== "approved") {
            console.log("Invalid or expired OTP");
            return res.status(401).json({ message: "Invalid or expired OTP" });
        }

        // If OTP is valid, generate the final token and send response
        const token = generateToken(phoneNumber, "admin", user._id);

        res.status(201).json({
            _id: user._id,
            phoneNumber: user.phoneNumber,
            email: user.email,
            name: user.name,
            role: user.role,
            token: token,
        });
    } catch (error) {
        console.error("Error in completeAdminLogin:", error);
        res.status(500).json({
            message: "Failed to verify OTP",
            error: error.message,
        });
    }
});

// @desc    Logout admin user / clear cookie
// @route   POST /api/admin/logout
// @access  Public
const logoutAdminUser = (req, res) => {
    req.session.destroy();
    res.status(201).json({ message: "Logged out successfully" });
  };
  
  const sendCustomNotification = asyncHandler(async (req, res) => {
    const { recipientId, recipientType, title, message } = req.body;
  
    // Validate recipient type (either Employee or BusinessAccount)
    if (!['Employee', 'BusinessAccount'].includes(recipientType)) {
      return res.status(400).json({ message: 'Invalid recipient type' });
    }
  
    // Fetch the recipient's information (Employee or BusinessAccount)
    let recipient;
    if (recipientType === 'Employee') {
      recipient = await EmployeeInfoModel.findById(recipientId);
    } else {
      recipient = await BusinessAccount.findById(recipientId);
    }
  
    // If recipient not found, return error
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
  
    // Create a new notification and save it in the database
    const newNotification = new Notification({
      senderId: req.adminId, // Assuming the admin's ID comes from a JWT token or session
      receiverId: recipientId,
      receiverType: recipientType,
      title,
      message,
    });
    await newNotification.save();
    // Send push notification if FCM token is available
  if (recipient.fcmToken) {
    await sendPushNotification(recipient.fcmToken, title, message);
  }

  // Return success response
  res.status(200).json({ message: 'Notification sent successfully' });
});

const sendEmployeeNotification = async (req, res) => {
    try {
        const { title, message, employeeId, category, jobTitles, sendToAll } = req.body;
        const adminId = req.adminId;

        let employees = [];

        // Case 1: Send to a specific employee
        if (employeeId) {
            employees = await EmployeeInfoModel.find({ id: employeeId });
        }
        // Case 2: Send to all employees
        else if (sendToAll) {
            employees = await EmployeeInfoModel.find();
        }
        // Case 3: Send to employees based on category or job title matches
        else if (category || jobTitles) {
            let query = {};

            // Check for category match
            if (category) {
                query['professionalPreferences.category'] = category;
            }

            // Check for job title match if jobTitles is provided
            if (jobTitles && jobTitles.length > 0) {
                query['professionalPreferences.jobTitle'] = { $in: jobTitles };
            }

            employees = await EmployeeInfoModel.find(query);
        }

        if (!employees.length) {
            return res.status(404).json({ message: 'No employees found' });
        }

        // Send notifications and save them in the database
        for (const employee of employees) {
            if (employee.fcmToken) {
                // Send push notification using the new function
                await sendPushNotification(employee.fcmToken, title, message);
            }

            // Save notification to DB
            const newNotification = new Notification({
                senderId: adminId,
                receiverId: employee._id,
                message,
                receiverType: 'employee',
            });
            await newNotification.save();
        }

        res.status(200).json({ message: 'Notification(s) sent successfully' });
    } catch (error) {
        console.error('Error sending employee notification:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
};

const sendBusinessNotification = async (req, res) => {
    try {
        const { title, message, businessId, category, sendToAll } = req.body;
        const adminId = req.adminId;

        let businesses = [];

        // Case 1: Send to a specific business
        if (businessId) {
            businesses = await BusinessAccount.find();
        }
        // Case 3: Send to businesses based on category from the Company model
        else if (category) {
            // Find companies with the given category inside companyprofile
            const companies = await Company.find({ 'companyprofile.category': category });

            if (!companies.length) {
                return res.status(404).json({ message: 'No companies found for the given category' });
            }

            // Extract the company IDs
            const companyIds = companies.map(company => company._id);

            // Find business accounts that match these company IDs
            businesses = await BusinessAccount.find({ companyId: { $in: companyIds } });
        }

        if (!businesses.length) {
            return res.status(404).json({ message: 'No businesses found' });
        }

        // Send notifications and save them in the database
        for (const business of businesses) {
            if (business.fcmToken) {
                // Send push notification using the new function
                await sendPushNotification(business.fcmToken, title, message);
            }

            // Save notification to DB
            const newNotification = new Notification({
                senderId: adminId,
                receiverId: business._id,
                message,
                receiverType: 'company',
            });
            await newNotification.save();
        }

        res.status(200).json({ message: 'Notification(s) sent successfully' });
    } catch (error) {
        console.error('Error sending business notification:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
};


const getUniqueEmployeeNotifications = async (req, res) => {
    try {
        const adminId = req.adminId;

        // Step 1: Fetch all notifications sent by admin to employees
        const notifications = await Notification.find({
            senderId: adminId,
            receiverType: 'employee',
        });

        if (!notifications.length) {
            return res.status(404).json({ message: 'No notifications found' });
        }

        // Step 2: Filter unique notifications based on the 'message' field
        const uniqueMessages = new Set();
        const uniqueNotifications = [];
        notifications.forEach(notification => {
            if (!uniqueMessages.has(notification.message)) {
                uniqueMessages.add(notification.message);
                uniqueNotifications.push(notification);
            }
        });

        // Step 3: Look up employee names for each unique notification
        const notificationsWithEmployeeInfo = await Promise.all(
            uniqueNotifications.map(async (notification) => {
                const employee = await EmployeeInfoModel.findById(notification.receiverId).select('personalInfo.name');
                return {
                    ...notification._doc,  // Spread the notification document
                    employeeName: employee ? employee.personalInfo.name : 'Unknown',  // Add employee name or 'Unknown'
                };
            })
        );

        res.status(200).json({ notifications: notificationsWithEmployeeInfo });
    } catch (error) {
        console.error('Error retrieving unique employee notifications:', error);
        res.status(500).json({ message: 'Failed to retrieve notifications' });
    }
};

const getUniqueBusinessNotifications = async (req, res) => {
    try {
        const adminId = req.adminId;

        // Step 1: Fetch all notifications sent by admin to businesses
        const notifications = await Notification.find({
            senderId: adminId,
            receiverType: 'company',
        });

        if (!notifications.length) {
            return res.status(404).json({ message: 'No notifications found' });
        }

        // Step 2: Filter unique notifications based on the 'message' field
        const uniqueMessages = new Set();
        const uniqueNotifications = [];
        notifications.forEach(notification => {
            if (!uniqueMessages.has(notification.message)) {
                uniqueMessages.add(notification.message);
                uniqueNotifications.push(notification);
            }
        });

        // Step 3: Look up business names for each unique notification
        const notificationsWithBusinessInfo = await Promise.all(
            uniqueNotifications.map(async (notification) => {
                const business = await BusinessAccount.findById(notification.receiverId).select('basicDetails.fullName');
                return {
                    ...notification._doc,  // Spread the notification document
                    businessName: business ? business.basicDetails.fullName : 'Unknown',  // Add business name or 'Unknown'
                };
            })
        );

        res.status(200).json({ notifications: notificationsWithBusinessInfo });
    } catch (error) {
        console.error('Error retrieving unique business notifications:', error);
        res.status(500).json({ message: 'Failed to retrieve notifications' });
    }
};

export {
    registerAdminUser,
    completeAdminRegistration,
    loginAdminUser,
    completeAdminLogin,
    logoutAdminUser,
    storeFcmToken,
    sendCustomNotification,
    sendEmployeeNotification,
    sendBusinessNotification,
    getUniqueEmployeeNotifications,
    getUniqueBusinessNotifications,
    editAdmin
};