import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { bucket } from '../utils/gcsConfig.js'; // GCS bucket configuration
import EmployeeInfo from '../models/employee/EmployeeInfo.model.js'; // Import EmployeeInfo model

const clientId = process.env.CASHFREE_CLIENT_ID;
const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_API_URL = 'https://api.cashfree.com/verification/aadhaar-masking';

export const maskAadhaar = async (req, res) => {
  try {
    const { employeeId } = req.body; // Employee ID from request body
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const aadhaarImagePath = req.file.path;
    const aadhaarImage = fs.createReadStream(aadhaarImagePath);
    const verificationId = `testverificationid-${Date.now()}`;

    // Call the Aadhaar masking API
    const response = await axios.post(CASHFREE_API_URL, {
      image: aadhaarImage,
      verification_id: verificationId,
    }, {
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'Content-Type': 'multipart/form-data',
      },
    });

    // Check if Aadhaar masking was successful
    if (response.data.status !== 'SUCCESS' || response.data.subCode !== 'VALID') {
      return res.status(400).json({ message: 'Masking failed', error: response.data });
    }

    const maskedImagePath = `masked-${req.file.filename}.png`;
    const gcsFile = bucket.file(maskedImagePath);

    // Upload the masked Aadhaar to Google Cloud Storage
    fs.createReadStream(aadhaarImagePath)
      .pipe(gcsFile.createWriteStream({
        resumable: false,
        contentType: 'image/png',
        metadata: { cacheControl: 'no-cache' },
      }))
      .on('finish', async () => {
        const gcsUrl = `https://storage.googleapis.com/${bucket.name}/${maskedImagePath}`;

        // Update employee's Aadhaar document with the GCS URL
        const employee = await EmployeeInfo.findOneAndUpdate(
          { _id: employeeId, 'documents.type': 'aadhaarCard' },
          {
            $set: {
              'documents.$.front.uri': gcsUrl,
              'documents.$.isCompleted': true,
            },
          },
          { new: true }
        );

        if (!employee) {
          return res.status(404).json({ message: 'Employee or Aadhaar document not found' });
        }

        res.status(200).json({
          message: 'Aadhaar masked, stored in GCP, and updated in employee info',
          gcsUrl,
          employee,
        });
      })
      .on('error', (err) => {
        res.status(500).json({ message: 'Failed to store image in GCP', error: err });
      });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Something went wrong', error });
  } finally {
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
  }
};