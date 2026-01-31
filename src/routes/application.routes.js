const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");
const applicationController = require("../controller/application.controller");

// Update candidate status (Recruiter only)
router.patch(
  "/:id/status",
  verifyToken,
  allowRoles("recruiter"),
  applicationController.updateApplicationStatus
);

// Recruiter - view applications (with pagination, sorting, filtering)
router.get(
  "/",
  verifyToken,
  allowRoles("recruiter"),
  applicationController.getApplicationsForRecruiter
);

// Candidate - view their own applications
router.get(
  "/me",
  verifyToken,
  allowRoles("candidate"),
  applicationController.getApplicationsForCandidate
);

// Resume preview (Recruiter only)
router.get(
  "/:id/resume",
  verifyToken,
  allowRoles("recruiter"),
  applicationController.getResume
);



module.exports = router;

