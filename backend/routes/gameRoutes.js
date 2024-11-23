const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { pool } = require('../utils/db');

router.post('/skip', protect, async (req, res) => {
  const { gameId, userId, lobbyId } = req.body;
  const io = req.app.get('io');

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update player's status
      await connection.execute(
        `UPDATE game_players 
         SET done_turn = TRUE,
             stepped_back = TRUE
         WHERE game_id = ? AND user_id = ?`,
        [gameId, userId]
      );

      // Get current game state
      const [gameState] = await connection.execute(
        `SELECT current_player_turn
         FROM game_state 
         WHERE game_id = ?`,
        [gameId]
      );

      // Get next active player
      const [players] = await connection.execute(
        `SELECT user_id, seat_position 
         FROM game_players 
         WHERE game_id = ? AND stepped_back = FALSE
         ORDER BY seat_position`,
        [gameId]
      );

      // Find next player's turn
      let nextTurn = gameState[0].current_player_turn;
      if (players.length > 0) {
        const currentIndex = players.findIndex(p => p.seat_position === nextTurn);
        nextTurn = players[(currentIndex + 1) % players.length]?.seat_position ?? 0;
      }

      // Update game state with next player's turn
      await connection.execute(
        `UPDATE game_state 
         SET current_player_turn = ?
         WHERE game_id = ?`,
        [nextTurn, gameId]
      );

      // Get updated game state to send to clients
      const [updatedGameState] = await connection.execute(
        `SELECT gs.*, gp.user_id, gp.cards, gp.seat_position, 
                gp.money, gp.is_active, gp.stepped_back, gp.done_turn
         FROM game_state gs
         LEFT JOIN game_players gp ON gs.game_id = gp.game_id
         WHERE gs.game_id = ?`,
        [gameId]
      );

      await connection.commit();

      // Format the game state for clients
      const formattedGameState = {
        gameId,
        currentTurn: nextTurn,
        players: updatedGameState.map(player => ({
          id: player.user_id,
          cards: player.cards ? player.cards.split(',') : [],
          seatPosition: player.seat_position,
          money: player.money,
          is_active: player.is_active,
          stepped_back: player.stepped_back,
          done_turn: player.done_turn
        }))
      };

      // Emit updated game state to all players in the lobby
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
