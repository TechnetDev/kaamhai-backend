import { uploadFileToGCS } from "../utils/uploadToGCP.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import axios from "axios";
import AadhaarVerification from "../models/aadharVerification.model.js";
// Function to send Aadhar otp
const sendAadhaarOTP = async (req, res) => {
  const { aadhaarNumber } = req.body;

  console.log("Received Aadhaar Number:", aadhaarNumber);

  const options = {
    method: "POST",
    url: "https://api.cashfree.com/verification/offline-aadhaar/otp", // Updated URL
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-client-id": process.env.CASHFREE_CLIENT_ID,
      "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
    },
    data: {
      aadhaar_number: aadhaarNumber,
    },
  };

  try {
    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ error: error.response ? error.response.data : error.message });
  }
};

const verifyAndSaveAadhaar = async (req, res) => {
  const { referenceId, otp, aadhaarNumber, candidateId } = req.body;
  let userId = req.employeeId; // Default to the logged-in user's ID

  if (candidateId) {
    userId = candidateId;
  }

  console.log("otp:", otp);
  console.log("userId:", userId);
  console.log("Request body:", req.body);

  try {
    const employeeData = await EmployeeInfoModel.findOne({ id: userId });
    if (!employeeData) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const options = {
      method: "POST",
      url: "https://api.cashfree.com/verification/offline-aadhaar/verify",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      },
      data: {
        otp: otp,
        ref_id: referenceId,
      },
    };

    console.log("Request options:", options);

    const response = await axios.request(options);
    console.log("Full response object:", response);

    // Ensure the API call returned a 200 status
    if (response.status !== 200) {
      console.error("Unexpected status code:", response.status);
      return res
        .status(response.status)
        .json({ error: "Unexpected status code from API." });
    }

    console.log("Received response data:", response.data);

    // Verify response structure
    const verificationStatus = response.data.status === "VALID";
    if (verificationStatus) {
      // Update or add Aadhaar document to employeeData
      const aadhaarDoc = employeeData.documents.find(
        (doc) => doc.type === "aadhaarCard"
      );
      if (aadhaarDoc) {
        aadhaarDoc.isVerified = true;
        aadhaarDoc.aadhaarNumber = aadhaarNumber;
        aadhaarDoc.isCompleted = true;
      } else {
        employeeData.documents.push({
          type: "aadhaarCard",
          aadhaarNumber: aadhaarNumber,
          isVerified: true,
          isCompleted: true,
        });
      }

      await employeeData.save();

      const aadhaarVerification = new AadhaarVerification({
        userId,
        refId: response.data.ref_id,
        status: response.data.status,
        message: response.data.message,
        careOf: response.data.care_of || "",
        address: response.data.address,
        dob: response.data.dob,
        gender: response.data.gender,
        name: response.data.name,
        splitAddress: {
          country: response.data.split_address.country,
          dist: response.data.split_address.dist,
          house: response.data.split_address.house,
          landmark: response.data.split_address.landmark,
          pincode: response.data.split_address.pincode,
          po: response.data.split_address.po,
          state: response.data.split_address.state,
          street: response.data.split_address.street,
          subdist: response.data.split_address.subdist,
          vtc: response.data.split_address.vtc,
        },
        yearOfBirth: response.data.year_of_birth,
        mobileHash: response.data.mobile_hash,
      });

      try {
        const savedDoc = await aadhaarVerification.save();
        console.log("Aadhaar Verification saved:", savedDoc);
      } catch (saveError) {
        console.error("Failed to save Aadhaar Verification:", saveError);
      }
    } else {
      console.log("Verification failed with code:", response.data.code);
    }

    // Return the response data from the API
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ error: error.response ? error.response.data : error.message });
  }
};

const getAadharDetails = async (req, res) => {
  const userId = req.employeeId;

  try {
    const documentData = await Document.findOne({ id: userId });

    if (!documentData) {
      return res.status(404).json({ message: "Document not found" });
    }

    const aadharDetails = {
      aadharNumber: documentData.aadharCard.aadharNumber,
      isVerified: documentData.aadharCard.isVerified,
      isCompleted: documentData.aadharCard.isCompleted,
      front: documentData.aadharCard.front
        ? {
            filename: documentData.aadharCard.front.filename,
            contentType: documentData.aadharCard.front.contentType,
            uri: documentData.aadharCard.front.uri,
            fileCopyUri: documentData.aadharCard.front.fileCopyUri,
          }
        : null,
      back: documentData.aadharCard.back
        ? {
            filename: documentData.aadharCard.back.filename,
            contentType: documentData.aadharCard.back.contentType,
            uri: documentData.aadharCard.back.uri,
            fileCopyUri: documentData.aadharCard.back.fileCopyUri,
          }
        : null,
    };

    res.json(aadharDetails);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export { sendAadhaarOTP, verifyAndSaveAadhaar, getAadharDetails };
