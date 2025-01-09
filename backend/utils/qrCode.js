import QRCode from "qrcode";
import fs from "fs";
import fsPromises from "fs/promises";
import { uploadFileToGCS } from "./uploadToGCP.js";

export const generateSaveQRCodePNG = async (url, employeeId) => {
  const outputDir = "./public/temp";
  const fileName = `${employeeId}-qrcode.png`;
  const outputPath = `${outputDir}/${fileName}`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await QRCode.toFile(outputPath, url);

  await uploadFileToGCS(employeeId, {
    filename: fileName,
    path: outputPath,
    mimetype: "image/png",
  });
};
/* Generating QR code locally
export const generateSaveQRCodePNG = async (url, employeeId) => {
  const outputDir = './public/temp';
  const fileName = `${employeeId}-qrcode.png`;
  const outputPath = `${outputDir}/${fileName}`;
 
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
  }

  try {
    await QRCode.toFile(outputPath, url);
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
  
  return outputPath;
};
*/
