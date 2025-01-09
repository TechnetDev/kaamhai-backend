import express from "express";
import {
  applyForJobPost,
  getApplicationsByEmployee,
  getApplicationsForJobPost,
  updateApplicationStatus,
  deleteJobApplication,
} from "../controllers/jobPostApplicationController.js";
import {
  getJobPostsForBusiness,
  getJobPostById,
  getJobPostsForEmployee,
  createJobPost,
  createSaveJobPost,
  closeJobPost,
  getSaveJobPostById,
  getSaveJobPostsForBusiness,
  editJobPost,
  updateJobPostStatus,
  updateFreeSubscription,
  getJobPostStatistics,
  updateJobPost,
  deleteJobPost,
  getJobPostDetails,
  getAdminMetrics,
  getPaginatedJobPostsForEmployee,
} from "../controllers/jobPostsController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";

const router = express.Router();

router.post("/job-post-applications/apply", protect, applyForJobPost);
router.put("/:id/status", protect, updateJobPostStatus);
router.get(
  "/job-post-applications/my-applications",
  protect,
  getApplicationsByEmployee
);

router.get("/admin/metrics", getAdminMetrics);
router.get(
  "/paginated/employee/job-posts",
  protect,
  getPaginatedJobPostsForEmployee
);

router.get(
  "/job-post-applications/:postId",
  protect,
  getApplicationsForJobPost
);
router.put(
  "/job-post-applications/:postId/applicants/:applicantId/:status",
  protect,
  updateApplicationStatus
);

router.put("/:id/close", protect, closeJobPost);
router.delete("/delete/:id", deleteJobPost);

router.get("/:companyId", protect, (req, res) => {
  getJobPostsForBusiness(req, res);
});
router.get("/employee/all", protect, getJobPostsForEmployee);
router.post(
  "/create",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  createJobPost
);

router.put("/edit/jobposts/:id", updateJobPost);
router.get("/adId/:id", protect, getJobPostById);

/*    Routes to save job posts   */

//post route to create job post and save it
router.post(
  "/save",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  createSaveJobPost
);
router.put(
  "/:id",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  editJobPost
);

//get route to view a saved job post
router.get("saved/:id", protect, getSaveJobPostById);

//get route to view all the saved job posts
router.get("/business/savedJobs/:companyId", getSaveJobPostsForBusiness);
router.get("/jobPost-details/:jobPostId", getJobPostDetails);
router.post("/:jobPostId/freeSubscription", updateFreeSubscription);

router.get("/testing/statistics", getJobPostStatistics);

router.delete(
  "/delete/job-applications/:applicationId",
  protect,
  deleteJobApplication
);
export default router;
