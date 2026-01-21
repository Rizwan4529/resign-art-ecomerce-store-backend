const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  submitContact,
  getContacts,
  getContactById,
  deleteContact,
} = require("../controllers/contactController");

const router = express.Router();

/**
 * Public Routes
 */

// Submit contact form (public)
router.post("/submit", submitContact);

/**
 * Admin Protected Routes
 */

// Get all contact submissions (admin only)
router.get("/", protect, authorize("ADMIN"), getContacts);

// Get single contact submission (admin only)
router.get("/:id", protect, authorize("ADMIN"), getContactById);

// Delete contact submission (admin only)
router.delete("/:id", protect, authorize("ADMIN"), deleteContact);

module.exports = router;
