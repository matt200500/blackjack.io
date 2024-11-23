const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { pool } = require('../utils/db');

router.post('/skip', protect, async (req, res) => {
  const { gameId, userId, lobbyId, seatPosition } = req.body;
  const io = req.app.get('io');

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
        `SELECT * FROM game_state WHERE game_id = ?`,
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
      const activePlayers = players.filter(p => !p.stepped_back);
      if (activePlayers.length > 0) {
        const currentPlayerIndex = activePlayers.findIndex(p => p.seat_position === nextTurn);
        nextTurn = activePlayers[(currentPlayerIndex + 1) % activePlayers.length]?.seat_position ?? nextTurn;
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
        currentTurn: nextTurn,
        potAmount: updatedGameState[0].pot_amount,
        players: players.map(player => ({
          id: player.user_id,
          seatPosition: player.seat_position,
          cards: player.cards ? player.cards.split(',') : [],
          money: player.money,
          is_active: player.is_active,
          stepped_back: player.stepped_back,
          done_turn: player.done_turn
        }))
      };

      await connection.commit();

      // Emit updated game state to all players
      io.to(lobbyId.toString()).emit('game state updated', formattedGameState);

      res.json({
        success: true,
        gameState: formattedGameState
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error handling skip:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process skip action'
    });
  }
});

module.exports = router;
