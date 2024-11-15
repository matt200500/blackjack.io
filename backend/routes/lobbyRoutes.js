const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { pool } = require("../utils/db");
const {
  createLobby,
  getLobbies,
  getLobby,
  joinLobby,
  leaveLobby,
  removePlayer,
  updateLobbySettings,
  startGame,
} = require("../controllers/lobbyController");

router.post("/create", protect, createLobby);
router.get("/", getLobbies);
router.get("/:id", getLobby);
router.post("/join/:id", protect, joinLobby);
router.post("/leave/:id", protect, leaveLobby);
router.post("/:id/remove-player", protect, removePlayer);
router.put("/:id/settings", protect, updateLobbySettings);
router.post("/:id/start-game", protect, startGame);
router.get("/:id/game-state", protect, async (req, res) => {
  try {
    const [lobby] = await pool.execute(
      "SELECT user_ids FROM lobby WHERE lobby_id = ?",
      [req.params.id]
    );

    if (!lobby.length) {
      return res.status(404).json({ message: "Lobby not found" });
    }

    const players = lobby[0].user_ids.split(",");
    const playerCount = players.length;

    const [gameState] = await pool.execute(
      `SELECT * FROM game_state 
       WHERE lobby_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.params.id]
    );

    if (gameState.length > 0) {
      res.json({
        gameState: {
          buttonPosition: gameState[0].button_position,
          smallBlindPosition: (gameState[0].button_position + 1) % playerCount,
          bigBlindPosition: (gameState[0].button_position + 2) % playerCount,
          currentTurn: gameState[0].current_player_turn,
        },
      });
    } else {
      res.json({ gameState: null });
    }
  } catch (error) {
    console.error("Error fetching game state:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
