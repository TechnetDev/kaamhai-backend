import jwt from "jsonwebtoken";
import asyncHandler from "../handlers/asyncHandler.js";
import EmployeeAuthModel from "../models/employee/employeeAuth.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import Admin from "../models/admin/admin.model.js";
import ExecutiveTeam from "../models/admin/executiveTeam.model.js";

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log("Token received:", token);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded Token:", decoded);

      let user = null;

      if (decoded.role === "employee") {
        if (decoded.userId) {
          user = await EmployeeAuthModel.findById(decoded.userId).select("-password");
          req.employeeId = decoded.userId;
        } else if (decoded.phoneNumber) {
          user = await EmployeeAuthModel.findOne({ phoneNumber: decoded.phoneNumber });
        }
      } else if (decoded.role === "employer") {
        if (decoded.userId) {
          user = await BusinessAccount.findById(decoded.userId).select("-password");
          req.employerId = decoded.userId;
        } else if (decoded.phoneNumber) {
          user = await BusinessAccount.findOne({ phoneNumber: decoded.phoneNumber });
        }
      } else if (decoded.role === "admin") { // Check if the role is admin
        if (decoded.userId) {
          user = await Admin.findById(decoded.userId).select("-password"); // Find user in Admin model
          req.adminId = decoded.userId;
        } else if (decoded.phoneNumber) {
          user = await Admin.findOne({ phoneNumber: decoded.phoneNumber });
        }
      } else if (decoded.role === "exec") { // Check if the role is admin
        if (decoded.userId) {
          user = await ExecutiveTeam.findById(decoded.userId).select("-password"); // Find user in Admin model
          req.adminId = decoded.userId;
        } else if (decoded.phoneNumber) {
          user = await ExecutiveTeam.findOne({ phoneNumber: decoded.phoneNumber });
        }
      }

      console.log("Found User:", user);

      if (!user) {
        throw new Error("User not found in any model");
      }

      req.user = user;
      req.role = decoded.role;
      console.log("UserId:", req.employeeId || req.employerId || req.adminId);
      console.log("PhoneNumber:", decoded.phoneNumber);
      next();
    } catch (error) {
      console.error("Error in token verification:", error.message);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    console.error("Authorization header missing or does not start with 'Bearer'");
    res.status(401).json({ message: "Not authorized, no token" });
  }
});

const admin = (req, res, next) => {
  if (req.user && req.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as an admin" });
  }
};

export { protect, admin };