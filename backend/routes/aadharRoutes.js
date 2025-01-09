import express from 'express';
import { maskAadhaar } from '../controllers/aadhaarController.js';
import { upload } from "../middlewares/multerMiddleware.js";

const router = express.Router();

router.post('/mask-aadhaar', upload.single('aadhaar-image'), maskAadhaar);

export default router;