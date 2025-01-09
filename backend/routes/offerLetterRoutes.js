import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createOfferLetter,
  getOfferLettersForEmployee,
  getOfferLettersForEmployer,
  getOfferLetterById,
  updateOfferLetter,
  deleteOfferLetter,
  acceptOfferLetter,
  rejectOfferLetter,
  getAcceptedOfferLetters,
  getRejectedOfferLetters,
  getAcceptedOfferLettersForEmployee,
  getRejectedOfferLettersForEmployee,
  getOfferLetterMetrics,
  generateOfferLetter,
} from "../controllers/offerLetterController.js";

const router = express.Router();

router.post("/", protect, createOfferLetter);
router.get("/employee", protect, getOfferLettersForEmployee);
router.get("/employer", protect, getOfferLettersForEmployer);
router.get("/:offerLetterId", protect, getOfferLetterById);
router.put("/:offerLetterId", protect, updateOfferLetter);
router.delete("/:offerLetterId", protect, deleteOfferLetter);
router.patch("/accept/:id", acceptOfferLetter);
router.patch("/reject/:id", rejectOfferLetter);
// Route to list accepted offer letters
router.get("/accepted/list", protect, getAcceptedOfferLetters);

router.post("/pdf/generate-offer-letter", async (req, res) => {
  try {
    const { logoPath, recipient, startDate, jobDetails, companyName } =
      req.body;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=offer_letter.pdf"
    );

    await generateOfferLetter({
      logoPath,
      recipient,
      startDate,
      jobDetails,
      companyName,
      res,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while generating the offer letter");
  }
});

// Route to list rejected offer letters
router.get("/rejected/list", protect, getRejectedOfferLetters);

router.get(
  "/employee/accepted/list",
  protect,
  getAcceptedOfferLettersForEmployee
);
// Route to list rejected offer letters for employee
router.get(
  "/employee/rejected/list",
  protect,
  getRejectedOfferLettersForEmployee
);

router.get("/admin/metrics", getOfferLetterMetrics);

export default router;
