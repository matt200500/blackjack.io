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

    const [gameState] = await pool.execute(
      `SELECT gs.*, gp.user_id, gp.cards, gp.seat_position 
       FROM game_state gs
       LEFT JOIN game_players gp ON gs.game_id = gp.game_id
       WHERE gs.lobby_id = ?
       ORDER BY gs.created_at DESC
       LIMIT 1`,
      [req.params.id]
    );

    if (gameState.length > 0) {
      // Get all players for this game
      const [players] = await pool.execute(
        `SELECT gp.user_id as id, gp.cards, gp.seat_position
         FROM game_players gp
         WHERE gp.game_id = ?`,
        [gameState[0].game_id]
      );

      // Format players data
      const formattedPlayers = players.map((player) => ({
        id: player.id,
        cards: player.cards ? player.cards.split(",") : [],
        seatPosition: player.seat_position,
      }));

      res.json({
        gameState: {
          currentTurn: gameState[0].current_player_turn,
          buttonPosition: gameState[0].button_position || 0,
          players: formattedPlayers,
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
