import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = __dirname;
const filePath = path.join(basePath, "test.json");

console.log(filePath);
const storage = new Storage({
  keyFilename: filePath,
});

export const uploadFileToGCS = async (bucketName, file) => {
  console.log(file);
  const bucket = storage.bucket(bucketName);

  // Check if the bucket exists
  const [exists] = await bucket.exists();
  console.log(exists);
  if (!exists) {
    // Create the bucket if it does not exist
    await bucket.create();
  }

  // Create a blob in the bucket and upload the file data
  const blob = bucket.file(file.filename);

  return new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(
        blob.createWriteStream({ resumable: false, contentType: file.mimetype })
      )
      .on("error", (error) => {
        console.error(error);
        reject(error);
      })
      .on("finish", () => {
        resolve(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
      });
  });
};

export const generateV4ReadSignedUrl = async (
  userId,
  fileName,
  expires = 7 * 24 * 60 * 60 * 1000
) => {
  // These options will allow temporary read access to the file
  const options = {
    version: "v4",
    action: "read",
    expires: Date.now() + expires,
  };

  // Get a v4 signed URL for reading the file
  const [url] = await storage
    .bucket("offbeat_data")
    .file(`${userID}/${fileName}`)
    .getSignedUrl(options);
  return url;
};

export const deleteFileFromGCS = async (bucketName, fileName) => {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.delete();
};
