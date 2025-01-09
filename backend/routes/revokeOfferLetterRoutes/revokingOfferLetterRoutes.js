import express from "express";
import {
  createRevokeContractLetter,
  getRevokeContractLettersByCompanyId,
  updateRevokeContractLetterStatus,
} from "../../controllers/revokeOfferLetterControllers/revokeContractLetterController.js";
import { protect } from "../../middlewares/authMiddleware.js";
const router = express.Router();

// POST route to create a new revoke contract letter
router.post("/revoke-contract", protect, createRevokeContractLetter);

// GET route to retrieve revoke contract letters by companyId
router.get(
  "/revoke-contract/:companyId",
  protect,
  getRevokeContractLettersByCompanyId
);

// PUT route to update revoke contract letter status
router.put(
  "/revoke-contract/:companyId/:revokeContractLetterId/status/:status",
  protect,
  updateRevokeContractLetterStatus
);

export default router;
