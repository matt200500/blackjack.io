const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { pool } = require("../utils/db");

const calculateCardTotal = (cards) => {
  if (!cards || !Array.isArray(cards)) return 0;

  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === "A") {
      aces++;
    } else if (["K", "Q", "J"].includes(card)) {
      total += 10;
    } else {
      total += parseInt(card);
    }
  }

  for (let i = 0; i < aces; i++) {
    if (total + 11 <= 21) {
      total += 11;
    } else {
      total += 1;
    }
  }

  return total;
};

router.post("/skip", protect, async (req, res) => {
  const { gameId, userId, lobbyId, seatPosition } = req.body;
  const io = req.app.get("io");

  if (!gameId || !userId || !lobbyId || seatPosition === undefined) {
    console.log("Received invalid data:", {
      gameId,
      userId,
      lobbyId,
      seatPosition,
    });
    return res.status(400).json({
      success: false,
      message: "Missing required data",
    });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update player's status
      await connection.execute(
        `UPDATE game_players 
         SET stepped_back = TRUE,
             done_turn = TRUE
         WHERE game_id = ? AND user_id = ?`,
        [gameId, userId]
      );

      // Get current game state
      const [gameState] = await connection.execute(
        `SELECT gs.*, gp.user_id, gp.seat_position, gp.cards, 
                gp.money, gp.is_active, gp.stepped_back, gp.done_turn,
                gs.current_round
         FROM game_state gs
         LEFT JOIN game_players gp ON gs.game_id = gp.game_id
         WHERE gs.game_id = ?`,
        [gameId]
      );

      // Get all players to determine next turn
      const [players] = await connection.execute(
        `SELECT user_id, seat_position, stepped_back, done_turn, cards, money, is_active
         FROM game_players 
         WHERE game_id = ? 
         ORDER BY seat_position`,
        [gameId]
      );

      // Find next active player
      let nextTurn = gameState[0].current_player_turn;
      const activePlayers = players.filter((p) => !p.stepped_back);
      if (activePlayers.length > 0) {
        const currentPlayerIndex = activePlayers.findIndex(
          (p) => p.seat_position === nextTurn
        );
        nextTurn =
          activePlayers[(currentPlayerIndex + 1) % activePlayers.length]
            ?.seat_position ?? nextTurn;
      }

      // Update game state with next player's turn
      await connection.execute(
        `UPDATE game_state 
         SET current_player_turn = ?
         WHERE game_id = ?`,
        [nextTurn, gameId]
      );

      // Get updated game state for response
      const [updatedGameState] = await connection.execute(
        `SELECT gs.*, gp.user_id, gp.seat_position, gp.cards, 
                gp.money, gp.is_active, gp.stepped_back, gp.done_turn
         FROM game_state gs
         LEFT JOIN game_players gp ON gs.game_id = gp.game_id
         WHERE gs.game_id = ?`,
        [gameId]
      );

      // Format the response
      const formattedGameState = {
        gameId,
        currentRound: gameState[0].current_round,
        currentTurn: nextTurn,
        potAmount: updatedGameState[0].pot_amount,
        players: players.map((player) => ({
          id: player.user_id,
          seatPosition: player.seat_position,
          cards: player.cards ? player.cards.split(",") : [],
          money: player.money,
          is_active: player.is_active,
          stepped_back: player.stepped_back,
          done_turn: player.done_turn,
        })),
      };

      await connection.commit();

      // Emit updated game state to all players
      io.to(lobbyId.toString()).emit("game state updated", formattedGameState);

      res.json({
        success: true,
        gameState: formattedGameState,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error handling skip:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process skip action",
    });
  }
});

router.post("/hit", protect, async (req, res) => {
  const { gameId, userId, lobbyId, seatPosition } = req.body;
  const io = req.app.get("io");

  if (!gameId || !userId || !lobbyId || seatPosition === undefined) {
    console.log("Missing required data:", {
      gameId,
      userId,
      lobbyId,
      seatPosition,
    });
    return res.status(400).json({
      success: false,
      message: "Missing required data",
    });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get current player's cards
      const [playerCards] = await connection.execute(
        `SELECT cards FROM game_players WHERE game_id = ? AND user_id = ?`,
        [gameId, userId]
      );

      // Generate a new card
      const newCard = generateCard(); // You'll need to implement this function
      const currentCards = playerCards[0].cards
        ? playerCards[0].cards.split(",")
        : [];
      const updatedCards = [...currentCards, newCard].join(",");

      // Update player's cards and set done_turn to true
      await connection.execute(
        `UPDATE game_players 
         SET cards = ?,
             done_turn = TRUE
         WHERE game_id = ? AND user_id = ?`,
        [updatedCards, gameId, userId]
      );

      // Get current game state
      const [gameState] = await connection.execute(
        `SELECT gs.*, gp.user_id, gp.seat_position, gp.cards, 
                gp.money, gp.is_active, gp.stepped_back, gp.done_turn,
                gs.current_round
         FROM game_state gs
         LEFT JOIN game_players gp ON gs.game_id = gp.game_id
         WHERE gs.game_id = ?`,
        [gameId]
      );

      // Get all players
      const [players] = await connection.execute(
        `SELECT user_id, seat_position, stepped_back, done_turn, cards, money, is_active
         FROM game_players 
         WHERE game_id = ? 
         ORDER BY seat_position`,
        [gameId]
      );

      // Find next active player
      let nextTurn = gameState[0].current_player_turn;
      const activePlayers = players.filter((p) => !p.stepped_back);
      if (activePlayers.length > 0) {
        const currentPlayerIndex = activePlayers.findIndex(
          (p) => p.seat_position === nextTurn
        );
        nextTurn =
          activePlayers[(currentPlayerIndex + 1) % activePlayers.length]
            ?.seat_position ?? nextTurn;
      }

      // Update game state with next player's turn
      await connection.execute(
        `UPDATE game_state 
         SET current_player_turn = ?
         WHERE game_id = ?`,
        [nextTurn, gameId]
      );

      // Format the response
      const formattedGameState = {
        gameId,
        currentRound: gameState[0].current_round,
        currentTurn: nextTurn,
        potAmount: gameState[0].pot_amount,
        players: players.map((player) => ({
          id: player.user_id,
          seatPosition: player.seat_position,
          cards: player.cards ? player.cards.split(",") : [],
          money: player.money,
          is_active: player.is_active,
          stepped_back: player.stepped_back,
          done_turn: player.done_turn,
        })),
      };

      await connection.commit();

      // Emit updated game state to all players
      io.to(lobbyId.toString()).emit("game state updated", formattedGameState);

      res.json({
        success: true,
        gameState: formattedGameState,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error handling hit:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process hit action",
      error: error.message,
    });
  }
});

// Helper function to generate a new card
function generateCard() {
  const cards = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  const randomIndex = Math.floor(Math.random() * cards.length);
  return cards[randomIndex];
}

const generateInitialCards = () => {
  const card1 = generateCard();
  const card2 = generateCard();
  return `${card1},${card2}`;
};

// Add this new endpoint
router.get("/check-round-status/:gameId", protect, async (req, res) => {
  const { gameId } = req.params;
  const io = req.app.get("io");

  try {
    const connection = await pool.getConnection();

    try {
      // First, let's see the actual state of all players
      const [playerStates] = await connection.execute(
        `SELECT user_id, done_turn, is_active
         FROM game_players 
         WHERE game_id = ?`,
        [gameId]
      );

      // Now check the counts
      const [players] = await connection.execute(
        `SELECT COUNT(*) as total_players, 
                SUM(CASE WHEN done_turn = TRUE THEN 1 ELSE 0 END) as done_players,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_players
         FROM game_players 
         WHERE game_id = ? AND is_active = TRUE`,
        [gameId]
      );

      const totalPlayers = Number(players[0].total_players);
      const donePlayers = Number(players[0].done_players);
      const activePlayers = Number(players[0].active_players);
      const allPlayersDone = totalPlayers === donePlayers;

      if (allPlayersDone) {
        const [gamePlayers] = await connection.execute(
          `SELECT gp.user_id, gp.cards, gp.stepped_back, gp.done_turn, gp.is_active
           FROM game_players gp
           WHERE gp.game_id = ? AND gp.is_active = TRUE`,
          [gameId]
        );

        // Check if all active players are either stepped back or have 21+
        const allPlayersCompleted = gamePlayers.every((player) => {
          const cardTotal = calculateCardTotal(player.cards?.split(",") || []);
          return player.stepped_back || cardTotal >= 21;
        });

        if (allPlayersCompleted) {
          const playerResults = gamePlayers.map((player) => ({
            userId: player.user_id,
            total: calculateCardTotal(player.cards?.split(",") || []),
            cards: player.cards,
          }));

          // Find highest non-busted total (21 or less)
          const validTotals = playerResults.filter((p) => p.total <= 21);
          const maxWinTotal =
            validTotals.length > 0
              ? Math.max(...validTotals.map((p) => p.total))
              : 0;
          const winningPlayers = playerResults.filter(
            (p) => p.total === maxWinTotal
          );
          const losingPlayers = playerResults.filter(
            (p) => p.total !== maxWinTotal
          );

          try {
            // Start transaction for updating wins and resetting game state
            await connection.beginTransaction();

            // Increment wins for winning players
            for (const winner of winningPlayers) {
              await connection.execute(
                `UPDATE users 
                 SET wins = wins + 1 
                 WHERE user_id = ?`,
                [winner.userId]
              );
            }

            for (const loser of losingPlayers) {
              await connection.execute(
                `UPDATE users 
                 SET losses = losses + 1 
                 WHERE user_id = ?`,
                [loser.userId]
              );
            }

            // Get all active players
            const [activePlayers] = await connection.execute(
              `SELECT user_id FROM game_players 
               WHERE game_id = ? AND is_active = TRUE`,
              [gameId]
            );

            // Reset game state with new cards for each player
            for (const player of activePlayers) {
              const card1 = generateCard();
              const card2 = generateCard();
              const newCards = `${card1},${card2}`;

              await connection.execute(
                `UPDATE game_players 
                 SET cards = ?,
                     stepped_back = FALSE,
                     done_turn = FALSE
                 WHERE game_id = ? AND user_id = ?`,
                [newCards, gameId, player.user_id]
              );
            }

            // Reset game state table
            await connection.execute(
              `UPDATE game_state 
               SET current_player_turn = 0,
                   current_round = 1
               WHERE game_id = ?`,
              [gameId]
            );

            // Get updated player information including wins
            const [updatedPlayers] = await connection.execute(
              `SELECT u.user_id, u.username, u.wins 
               FROM users u 
               JOIN game_players gp ON u.user_id = gp.user_id 
               WHERE gp.game_id = ?`,
              [gameId]
            );

            await connection.commit();

            // Get the new game state for broadcasting
            const [newGameState] = await connection.execute(
              `SELECT gs.*, gp.user_id, gp.seat_position, gp.cards, 
                      gp.money, gp.is_active, gp.stepped_back, gp.done_turn
               FROM game_state gs
               LEFT JOIN game_players gp ON gs.game_id = gp.game_id
               WHERE gs.game_id = ?`,
              [gameId]
            );

            // Format the new game state
            const formattedNewGameState = {
              gameId,
              currentRound: 1,
              currentTurn: 0,
              players: newGameState.map((player) => ({
                id: player.user_id,
                seatPosition: player.seat_position,
                cards: player.cards ? player.cards.split(",") : [],
                money: player.money,
                is_active: player.is_active,
                stepped_back: player.stepped_back,
                done_turn: player.done_turn,
              })),
            };

            // Get the lobbyId along with other game state info
            const [gameInfo] = await connection.execute(
              `SELECT gs.*, l.lobby_id as lobby_id
               FROM game_state gs
               JOIN lobbies l ON gs.lobby_id = l.lobby_id
               WHERE gs.game_id = ?`,
              [gameId]
            );

            const lobbyId = gameInfo[0].lobby_id;

            // Emit game ended event with winners and updated player information
            console.log("Emitting game ended event to lobby:", lobbyId);
            io.to(lobbyId.toString()).emit("game ended", {
              winners: winningPlayers,
              losers: losingPlayers,
              updatedPlayers,
              newGameState: formattedNewGameState,
            });

            return res.json({
              success: true,
              gameEnded: true,
              roundComplete: true,
              winners: winningPlayers,
              allPlayerResults: playerResults,
              updatedPlayers,
            });
          } catch (error) {
            console.log("AAAAAAAAAAAAAAAAAAAAAAAA", error);
            await connection.rollback();
            throw error;
          }
        }
      }

      res.json({
        success: true,
        allPlayersDone,
        roundComplete: allPlayersDone,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error checking round status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check round status",
    });
  }
});

module.exports = router;
