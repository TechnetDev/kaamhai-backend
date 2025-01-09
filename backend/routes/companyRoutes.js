import express from "express";
import {
  listOfCompanies,
  createCompany,
  updateCompanyInfo,
  selectCompany,
  getCompanyById,
  getUnverifiedCompanies,
  updateProfilePicture,
  uploadCompanyPhotos,
  verifyCompany,
  deleteCompany,
  getCompanyPhotos,
  getCompanyPhotoById,
  deleteCompanyPhotoByUrl,
  uploadCompanyBackgroundPhoto,
  getCompanyBackgroundPhoto,
  getCompanyLogo,
} from "../controllers/companyController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";
import {
  delinkCompanyAndEmployee,
  getEmployeesByCompany,
} from "../controllers/offerLetterController.js";
import {
  acceptEmployeeCompanyRequest,
  getCompanyRequestsAndMappings,
  rejectEmployeeCompanyRequest,
} from "../controllers/onboardingExistingEmployee.js";

const router = express.Router();

// ... existing code ...

router.post("/createCompany", protect, createCompany);

router.put(
  "/acceptEmployeeLinkRequest/:employeeId",
  protect,
  acceptEmployeeCompanyRequest
);
router.get("/linkingRequests", protect, getCompanyRequestsAndMappings);
router.put(
  "/rejectEmployeeLinkRequest/:employeeId",
  protect,
  rejectEmployeeCompanyRequest
);
router.post("/selectCompany", protect, selectCompany);
//For admin panel
// Route to get all companies
router.get("/listOfCompanies", listOfCompanies);
//get routes to get company details
router.get("/:companyId", getCompanyById);
//route to get all unverified companies
router.get("/listOfUnverified", getUnverifiedCompanies);
//put route to update the status of the company
router.put("/verify/:companyId", verifyCompany);
//delete route to delete a company
router.delete("/delete/:companyId", deleteCompany);
// get route to fetch all the employees working in a company
router.get("/:companyId/employees", getEmployeesByCompany);
// delete route to delink company and employee(employees)
router.delete("/delink/:companyId/:employeeId", delinkCompanyAndEmployee);
router.put("/:id/edit", updateCompanyInfo);

router.put(
  "/:id/profile-picture",
  protect,
  upload.single("logo"),
  updateProfilePicture
);
router.post(
  "/:id/photos",
  protect,
  upload.array("photos", 10),
  uploadCompanyPhotos
);
router.get("/:id/photos", getCompanyPhotos);
router.get("/:id/photos/:photoId", getCompanyPhotoById);
router.delete("/:id/photos/", protect, deleteCompanyPhotoByUrl);
router.put(
  "/:id/background-photo",
  upload.single("backgroundPhoto"),
  uploadCompanyBackgroundPhoto
);
router.get("/:id/background-photo", getCompanyBackgroundPhoto);
router.get("/:id/logo", getCompanyLogo);

export default router;
