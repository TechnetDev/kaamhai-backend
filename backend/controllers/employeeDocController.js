import Document from "../models/employee/EmployeeDoc.model.js";
import EmployeeInfoModel from "../models/employee/EmployeeInfo.model.js";
import {
  uploadFileToGCS,
  generateV4ReadSignedUrl,
} from "../utils/uploadToGCP.js";
import admin from "firebase-admin";
import { sendDocumentUploadNotification } from "../utils/notificationUtils.js";

const handleDocumentUpload = async (req, res) => {
  try {
    const userId = req.employeeId;
    const { facePhoto } = req.files;

    let employeeData = await EmployeeInfoModel.findOne({ id: userId });

    if (facePhoto && facePhoto.length > 0) {
      // Upload file to GCS (Google Cloud Storage)
      await uploadFileToGCS(userId, facePhoto[0]);

      // Update employee document with photo info
      employeeData.facePhoto = {
        filename: facePhoto[0].filename,
        contentType: facePhoto[0].mimetype,
        uri: facePhoto[0].path,
        fileCopyUri: facePhoto[0].destination + facePhoto[0].filename,
        isCompleted: true,
      };

      // Save the changes in database
      await employeeData.save();

      // Trigger notification logic
      await sendDocumentUploadNotification(
        employeeData.fcmToken,
        "Your ID card has been generated successfully!"
      );

      res.status(200).json({ message: "Document uploaded successfully" });
    } else {
      res.status(400).json({ message: "No document uploaded" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error uploading document", error: error.message });
  }
};

const getDocumentData = async (req, res) => {
  try {
    const userId = req.employeeId;

    const documentData = await Document.findOne({ id: userId });
    const employeeData = await EmployeeInfoModel.findOne({ id: userId });
    if (!documentData) {
      return res
        .status(404)
        .json({ message: "No document data found for the given user ID" });
    }
    const responseData = {};
    const keys = Object.keys(documentData["_doc"]);
    await Promise.all(
      keys.map(async (key) => {
        if (documentData[key]?.isCompleted) {
          if (key == "facePhoto") {
            const facePhoto = documentData[key];
            const frontUri = await generateV4ReadSignedUrl(
              userId,
              facePhoto.filename
            );
            facePhoto.uri = frontUri;

            responseData[key] = {
              ...facePhoto,
              isCompleted: documentData[key]?.isCompleted,
            };
          }
        }
      })
    );

    // Handle facePhoto separately
    if (employeeData.facePhoto?.isCompleted) {
      const facePhoto = employeeData.facePhoto;
      const frontUri = await generateV4ReadSignedUrl(
        userId,
        facePhoto.filename
      );
      facePhoto.uri = frontUri;

      responseData.facePhoto = {
        ...facePhoto,
        isCompleted: employeeData.facePhoto.isCompleted,
      };
    }

    console.log(responseData);

    // if (!responseData) {
    // return res
    // .status(404)
    //.json({ message: "No document data found for the given user ID" });
    //}

    res.status(200).json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error retrieving document data",
      error: error.message,
    });
  }
};

const handleOtherDocumentUpload = async (req, res) => {
  try {
    let userId = req.employeeId;
    const { documentType, candidateId } = req.body;
    const { frontPhoto, backPhoto } = req.files;

    // If candidateId is provided, use it as userId (for admin uploading on behalf of user)
    if (candidateId) {
      userId = candidateId;
    }

    // Check if userId, documentType, frontPhoto, and backPhoto are provided
    if (!userId || !documentType || !frontPhoto || !backPhoto) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("userId:", userId);
    const employeeData = await EmployeeInfoModel.findOne({ id: userId });

    console.log("frontPhoto:", frontPhoto);
    console.log("backPhoto:", backPhoto);
    await uploadFileToGCS(userId, frontPhoto[0]);
    await uploadFileToGCS(userId, backPhoto[0]);

    const newDocument = {
      type: documentType,
      front: {
        filename: frontPhoto[0].filename,
        contentType: frontPhoto[0].mimetype,
        uri: frontPhoto[0].path,
        fileCopyUri: frontPhoto[0].destination + frontPhoto[0].filename,
      },
      back: {
        filename: backPhoto[0].filename,
        contentType: backPhoto[0].mimetype,
        uri: backPhoto[0].path,
        fileCopyUri: backPhoto[0].destination + backPhoto[0].filename,
      },
      isCompleted: true,
    };

    employeeData.documents.push(newDocument);
    await employeeData.save();

    res.status(200).json({ message: "Document uploaded successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error uploading document", error: error.message });
  }
};

const handleDocumentReplace = async (req, res) => {
  try {
    let userId = req.employeeId;
    const { documentType, candidateId } = req.body;
    const { frontPhoto, backPhoto } = req.files;

    // If candidateId is provided, use it as userId (for admin uploading on behalf of user)
    if (candidateId) {
      userId = candidateId;
    }

    // Check if userId, documentType, frontPhoto, and backPhoto are provided
    if (!userId || !documentType || !frontPhoto || !backPhoto) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("userId:", userId);
    const employeeData = await EmployeeInfoModel.findOne({ id: userId });

    if (!employeeData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Find the existing document by documentType
    const documentIndex = employeeData.documents.findIndex(
      (doc) => doc.type === documentType
    );

    // Upload new front and back photos
    console.log("frontPhoto:", frontPhoto);
    console.log("backPhoto:", backPhoto);
    await uploadFileToGCS(userId, frontPhoto[0]);
    await uploadFileToGCS(userId, backPhoto[0]);

    const newDocumentData = {
      type: documentType,
      front: {
        filename: frontPhoto[0].filename,
        contentType: frontPhoto[0].mimetype,
        uri: frontPhoto[0].path,
        fileCopyUri: frontPhoto[0].destination + frontPhoto[0].filename,
      },
      back: {
        filename: backPhoto[0].filename,
        contentType: backPhoto[0].mimetype,
        uri: backPhoto[0].path,
        fileCopyUri: backPhoto[0].destination + backPhoto[0].filename,
      },
      isCompleted: true,
    };

    if (documentIndex !== -1) {
      // If document exists, replace it
      employeeData.documents[documentIndex] = newDocumentData;
    } else {
      // If document does not exist, add it
      employeeData.documents.push(newDocumentData);
    }

    await employeeData.save();

    res
      .status(200)
      .json({ message: "Document uploaded/replaced successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error processing document", error: error.message });
  }
};

export {
  handleDocumentUpload,
  getDocumentData,
  handleOtherDocumentUpload,
  handleDocumentReplace,
};
