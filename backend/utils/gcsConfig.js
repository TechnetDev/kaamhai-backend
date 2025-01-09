import { Storage } from "@google-cloud/storage";
import path from "path";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: path.join(process.cwd(), process.env.GCS_KEYFILE_PATH), // Path to your GCS keyfile
  projectId: process.env.GCS_PROJECT_ID, // Your Google Cloud project ID
});

// Specify your bucket
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

export { bucket };
