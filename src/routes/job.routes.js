const express = require("express");
const router = express.Router();

const jobController = require("../controller/job.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");
router.get("/", jobController.getJobs);
router.get("/filters/locations", jobController.getLocations);
router.get("/filters/skills", jobController.getSkills);

// saved jobs (candidate)
router.post(
  "/:id/save",
  verifyToken,
  allowRoles("candidate"),
  jobController.saveJob
);
router.delete(
  "/:id/save",
  verifyToken,
  allowRoles("candidate"),
  jobController.unsaveJob
);
router.get(
  "/saved",
  verifyToken,
  allowRoles("candidate"),
  jobController.getSavedJobs
);

// related jobs
router.get("/:id/related", jobController.getRelatedJobs);

// migrate saved job IDs from client localStorage to DB
router.post(
  "/saved/migrate",
  verifyToken,
  allowRoles("candidate"),
  jobController.migrateSavedJobs
);



// Recruiter only
router.post(
  "/",
  verifyToken,
  allowRoles("recruiter"),
  jobController.createJob
);

// Recruiter - list own jobs
router.get(
  "/mine",
  verifyToken,
  allowRoles("recruiter"),
  jobController.getRecruiterJobs
);

// Recruiter - delete own job
router.delete(
  "/:id",
  verifyToken,
  allowRoles("recruiter"),
  jobController.deleteJob
);
// candidate only
const upload = require("../config/multer.config");

// Apply job with resume
router.post(
  "/:id/apply",
  verifyToken,
  allowRoles("candidate"),
  upload.single("resume"),
  jobController.applyJob
);

// check if candidate already applied
router.get(
  "/:id/applied",
  verifyToken,
  allowRoles("candidate"),
  jobController.isApplied
);

// recruiter only
router.get(
  "/:id/applications",
  verifyToken,
  allowRoles("recruiter"),
  jobController.viewApplications
);

// single job detail (param route must come after static routes like /mine)
router.get('/:id', jobController.getJobById);

module.exports = router;
