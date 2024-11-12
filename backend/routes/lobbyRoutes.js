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
} = require("../controllers/lobbyController");

router.post("/create", protect, createLobby);
router.get("/", getLobbies);
router.get("/:id", getLobby);
router.post("/join/:id", protect, joinLobby);
router.post("/leave/:id", protect, leaveLobby);
router.post("/:id/remove-player", protect, removePlayer);

module.exports = router;
