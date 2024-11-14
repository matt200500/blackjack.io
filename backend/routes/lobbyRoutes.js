const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createLobby,
  getLobbies,
  getLobby,
  joinLobby,
  leaveLobby,
  removePlayer,
  updateLobbySettings,
} = require("../controllers/lobbyController");

router.post("/create", protect, createLobby);
router.get("/", getLobbies);
router.get("/:id", getLobby);
router.post("/join/:id", protect, joinLobby);
router.post("/leave/:id", protect, leaveLobby);
router.post("/:id/remove-player", protect, removePlayer);
router.put("/:id/settings", protect, updateLobbySettings);

module.exports = router;
