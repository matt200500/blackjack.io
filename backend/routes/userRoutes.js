const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  checkUsername,
  updateProfilePicture,
  updateProfile,
  getAllUsers,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

// Get all users
router.get("/", getAllUsers);

// Register a new user
router.post("/register", registerUser);

// Login a user
router.post("/login", loginUser);

// Check username availability
router.get("/check-username/:username", checkUsername);

// Update profile picture
router.put("/update-profile-picture", protect, updateProfilePicture);

// Update profile
router.put("/update-profile", protect, updateProfile);

module.exports = router;
