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

router.get("/stats/:userId", protect, async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT user_id, wins, losses, games_played FROM users WHERE user_id = ?",
      [req.params.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      wins: users[0].wins,
      losses: users[0].losses,
      gamesPlayed: users[0].games_played,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user stats" });
  }
});

module.exports = router;
