const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { pool } = require('../utils/db');

router.post('/skip', protect, async (req, res) => {
  const { gameId, userId, lobbyId, seatPosition } = req.body;
  const io = req.app.get('io');

  if (!gameId || !userId || !lobbyId || seatPosition === undefined) {
    console.log('Received invalid data:', { gameId, userId, lobbyId, seatPosition });
    return res.status(400).json({
      success: false,
      message: 'Missing required data'
    });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      console.log('Executing update with:', { gameId, userId });
      
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

      console.log('Fetched game state:', gameState[0]);

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
        currentRound: gameState[0].current_round,
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

      console.log('Formatted game state:', formattedGameState);

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

router.post('/hit', protect, async (req, res) => {
  const { gameId, userId, lobbyId, seatPosition } = req.body;
  const io = req.app.get('io');

  if (!gameId || !userId || !lobbyId || seatPosition === undefined) {
    console.log('Missing required data:', { gameId, userId, lobbyId, seatPosition });
    return res.status(400).json({
      success: false,
      message: 'Missing required data'
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
      const currentCards = playerCards[0].cards ? playerCards[0].cards.split(',') : [];
      const updatedCards = [...currentCards, newCard].join(',');

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

      console.log('Fetched game state:', gameState[0]);

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

      // Format the response
      const formattedGameState = {
        gameId,
        currentRound: gameState[0].current_round,
        currentTurn: nextTurn,
        potAmount: gameState[0].pot_amount,
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

      console.log('Formatted game state:', formattedGameState);

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
    console.error('Error handling hit:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process hit action',
      error: error.message
    });
  }
});

// Helper function to generate a new card
function generateCard() {
  const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const randomIndex = Math.floor(Math.random() * cards.length);
  return cards[randomIndex];
}

// Add this new endpoint
router.get('/check-round-status/:gameId', protect, async (req, res) => {
  console.log('Route hit: check-round-status with gameId:', req.params.gameId);
  const { gameId } = req.params;
  const io = req.app.get('io');

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
      console.log('Current player states:', playerStates);

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

      console.log('Player turn status:', {
        totalPlayers,
        donePlayers,
        activePlayers
      });

      const allPlayersDone = totalPlayers === donePlayers;
      console.log('All players done:', allPlayersDone);

      if (allPlayersDone) {
        // Get current round
        const [currentGameState] = await connection.execute(
          `SELECT current_round FROM game_state WHERE game_id = ?`,
          [gameId]
        );

        console.log('Current game state:', currentGameState[0]);
        const newRound = (currentGameState[0].current_round || 0) + 1;
        console.log('Updating to new round:', newRound);

        // Update round and reset done_turn for all players
        await connection.beginTransaction();

        // Update the round first
        await connection.execute(
          `UPDATE game_state 
           SET current_round = ?
           WHERE game_id = ?`,
          [newRound, gameId]
        );

        // Then reset player states in a separate transaction
        await connection.execute(
          `UPDATE game_players 
           SET done_turn = FALSE,
               stepped_back = FALSE
           WHERE game_id = ?`,
          [gameId]
        );

        await connection.commit();

        // Get updated game state for response
        const [updatedGameState] = await connection.execute(
          `SELECT gs.*, gp.user_id, gp.seat_position, gp.cards, 
                  gp.money, gp.is_active, gp.stepped_back, gp.done_turn
           FROM game_state gs
           LEFT JOIN game_players gp ON gs.game_id = gp.game_id
           WHERE gs.game_id = ?`,
          [gameId]
        );

        // Format and emit updated state
        const formattedGameState = {
          gameId,
          currentRound: newRound,
          currentTurn: updatedGameState[0].current_player_turn,
          potAmount: updatedGameState[0].pot_amount,
          players: updatedGameState.map(player => ({
            id: player.user_id,
            seatPosition: player.seat_position,
            cards: player.cards ? player.cards.split(',') : [],
            money: player.money,
            is_active: player.is_active,
            stepped_back: player.stepped_back,
            done_turn: player.done_turn
          }))
        };

        io.to(gameId.toString()).emit('game state updated', formattedGameState);
      }

      res.json({
        success: true,
        allPlayersDone,
        roundComplete: allPlayersDone
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error checking round status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check round status'
    });
  }
});

module.exports = router;
