const { pool } = require("../utils/db");
const bcrypt = require("bcrypt");

const createLobby = async (req, res) => {
  const { name, password, expertiseLevel } = req.body;
  const hostId = req.user.user_id;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create lobby with properly formatted JSON array of user IDs
      const [result] = await connection.execute(
        `INSERT INTO lobbies (
          lobby_name, 
          lobby_password, 
          expertise_level, 
          lobby_owner, 
          user_ids,
          starting_bank
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          password ? await bcrypt.hash(password, 10) : null,
          expertiseLevel,
          hostId,
          hostId.toString(),
          1000,
        ]
      );

      // Get the created lobby with player information
      const [lobbies] = await connection.execute(
        `
        SELECT l.*, u.username as host_username
        FROM lobbies l
        JOIN users u ON l.lobby_owner = u.user_id
        WHERE l.lobby_id = ?
      `,
        [result.insertId]
      );

      const lobby = lobbies[0];

      // Format the response
      const formattedLobby = {
        id: lobby.lobby_id,
        name: lobby.lobby_name,
        host: {
          id: lobby.lobby_owner,
          username: lobby.host_username,
        },
        expertiseLevel: lobby.expertise_level,
        password: lobby.lobby_password ? true : false,
        starting_bank: lobby.starting_bank || 1000,
        createdAt: new Date(),
      };

      await connection.commit();
      connection.release();

      res.status(201).json(formattedLobby);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error in createLobby:", error);
    res
      .status(500)
      .json({ message: "Failed to create lobby", error: error.message });
  }
};

const getLobbies = async (req, res) => {
  const {
    sortBy = "lobby_id",
    order = "desc",
    includePasswordProtected = "all",
  } = req.query;

  try {
    const connection = await pool.getConnection();

    // Build the base query with comma counting instead of JSON_LENGTH
    let query = `
      SELECT 
        l.lobby_id as id,
        l.lobby_name as name,
        l.expertise_level as expertiseLevel,
        CASE WHEN l.lobby_password IS NOT NULL AND l.lobby_password != '' THEN 1 ELSE 0 END as hasPassword,
        CASE 
          WHEN l.user_ids IS NULL OR l.user_ids = '' THEN 0 
          ELSE (LENGTH(l.user_ids) - LENGTH(REPLACE(l.user_ids, ',', '')) + 1)
        END as playerCount,
        u.username as hostUsername,
        u.user_id as hostId
      FROM lobbies l
      LEFT JOIN users u ON l.lobby_owner = u.user_id
      WHERE l.is_open = 1
    `;

    // Add password protection filter
    if (includePasswordProtected === "yes") {
      query += ` AND l.lobby_password IS NOT NULL AND l.lobby_password != ''`;
    } else if (includePasswordProtected === "no") {
      query += ` AND (l.lobby_password IS NULL OR l.lobby_password = '')`;
    }

    query += ` AND (l.locked = 0)`;

    // Add sorting
    const validSortFields = [
      "lobby_id",
      "lobby_name",
      "expertise_level",
      "username",
    ];
    const sanitizedSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "lobby_id";
    const sanitizedOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    query += ` ORDER BY ${sanitizedSortBy} ${sanitizedOrder}`;

    const [lobbies] = await connection.execute(query);
    connection.release();

    // Transform the results
    const formattedLobbies = lobbies.map((lobby) => ({
      id: lobby.id,
      name: lobby.name,
      expertiseLevel: lobby.expertiseLevel,
      hasPassword: Boolean(lobby.hasPassword),
      playerCount: lobby.playerCount,
      host: {
        id: lobby.hostId,
        username: lobby.hostUsername,
      },
    }));

    res.json(formattedLobbies);
  } catch (error) {
    console.error("Error in getLobbies:", error);
    res.status(500).json({
      message: "Failed to retrieve lobbies",
      error: error.message,
    });
  }
};

const joinLobby = async (req, res) => {
  const { id: lobbyId } = req.params;
  const { password } = req.body;
  const userId = req.user.user_id;
  const io = req.app.get("io");

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get lobby
      const [lobbies] = await connection.execute(
        "SELECT * FROM lobbies WHERE lobby_id = ?",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: "Lobby not found" });
      }

      const lobby = lobbies[0];

      // Check if the lobby is locked
      if (lobby.locked) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ message: "Lobby is locked" });
      }

      // Check password if exists
      if (lobby.lobby_password) {
        const isPasswordCorrect = await bcrypt.compare(
          password,
          lobby.lobby_password
        );
        if (!isPasswordCorrect) {
          await connection.rollback();
          connection.release();
          return res.status(403).json({ message: "Incorrect password" });
        }
      }

      // Parse user_ids from comma-separated string
      let userIds = lobby.user_ids ? lobby.user_ids.split(",") : [];

      if (!userIds.includes(userId.toString())) {
        userIds.push(userId.toString());
        await connection.execute(
          "UPDATE lobbies SET user_ids = ? WHERE lobby_id = ?",
          [userIds.join(","), lobbyId]
        );
      }

      // Get updated player information
      const [players] = await connection.execute(
        `
        SELECT user_id, username
        FROM users
        WHERE user_id IN (${userIds.map(() => "?").join(",")})
      `,
        userIds
      );

      await connection.commit();
      connection.release();

      // Emit to ALL clients in the lobby
      const formattedPlayers = players.map((player) => ({
        id: player.user_id,
        username: player.username,
      }));

      io.to(lobbyId).emit("player joined", {
        players: formattedPlayers,
      });

      res.json({
        message: "Joined lobby successfully",
        players: formattedPlayers,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error in joinLobby:", error);
    res
      .status(500)
      .json({ message: "Failed to join lobby", error: error.message });
  }
};

const getLobby = async (req, res) => {
  const { id } = req.params;

  try {
    const [lobbies] = await pool.execute(
      `
      SELECT l.*, u.username as host_username
      FROM lobbies l
      JOIN users u ON l.lobby_owner = u.user_id
      WHERE l.lobby_id = ?
    `,
      [id]
    );

    if (lobbies.length === 0) {
      return res.status(404).json({ message: "Lobby not found" });
    }

    const lobby = lobbies[0];

    // Parse user_ids from comma-separated string
    const playerIds = lobby.user_ids ? lobby.user_ids.split(",") : [];

    // Get player information if there are any players
    let players = [];
    if (playerIds.length > 0) {
      const [playerResults] = await pool.execute(
        `SELECT user_id, username 
         FROM users 
         WHERE user_id IN (${playerIds.map(() => "?").join(",")})`,
        playerIds
      );
      players = playerResults;
    }

    const formattedLobby = {
      id: lobby.lobby_id,
      name: lobby.lobby_name,
      host: {
        id: lobby.lobby_owner,
        username: lobby.host_username,
      },
      expertiseLevel: lobby.expertise_level,
      starting_bank: lobby.starting_bank || 1000,
      buy_in: lobby.buy_in || 100,
      players: players.map((player) => ({
        id: player.user_id,
        username: player.username,
      })),
    };

    res.json(formattedLobby);
  } catch (error) {
    console.error("Error in getLobby:", error);
    res.status(500).json({
      message: "Failed to get lobby",
      error: error.message,
    });
  }
};

const leaveLobby = async (req, res) => {
  const lobbyId = req.params.id;
  const userId = req.user.user_id;
  const io = req.app.get("io");
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // First check if user is host
    const [lobby] = await connection.query(
      "SELECT user_ids, lobby_owner, current_game_id FROM lobbies WHERE lobby_id = ?",
      [lobbyId]
    );

    if (!lobby.length) {
      throw new Error("Lobby not found");
    }

    const isHost = lobby[0].lobby_owner === userId;

    if (isHost) {
      // Set current_game_id to NULL to break the foreign key constraint
      await connection.query(
        "UPDATE lobbies SET current_game_id = NULL WHERE lobby_id = ?",
        [lobbyId]
      );

      // Delete game_players first (due to foreign key constraints)
      await connection.query(
        `DELETE gp FROM game_players gp 
         INNER JOIN game_state gs ON gp.game_id = gs.game_id 
         WHERE gs.lobby_id = ?`,
        [lobbyId]
      );

      // Delete game_state
      await connection.query("DELETE FROM game_state WHERE lobby_id = ?", [
        lobbyId,
      ]);

      // Delete the lobby
      await connection.query("DELETE FROM lobbies WHERE lobby_id = ?", [
        lobbyId,
      ]);

      // Notify all players in the lobby
      io.to(lobbyId).emit("host left lobby", { lobbyId });
    } else {
      // Regular player leaving logic
      // First, check if there's an active game
      const [gameState] = await connection.query(
        "SELECT game_id FROM game_state WHERE lobby_id = ? ORDER BY created_at DESC LIMIT 1",
        [lobbyId]
      );

      if (gameState.length > 0) { // if there is an active game
        await connection.query(
          "UPDATE lobbies SET current_game_id = NULL WHERE lobby_id = ?",
          [lobbyId]
        );
        // Delete game_players first (due to foreign key constraints)
        await connection.query(
          `DELETE gp FROM game_players gp 
           INNER JOIN game_state gs ON gp.game_id = gs.game_id 
           WHERE gs.lobby_id = ?`,
          [lobbyId]
        );

        // Delete game_state
        await connection.query("DELETE FROM game_state WHERE lobby_id = ?", [
          lobbyId,
        ]);

        // Delete the lobby
        await connection.query("DELETE FROM lobbies WHERE lobby_id = ?", [
          lobbyId,
        ]);
  
        // Get the username of the user leaving
        const [user] = await connection.query(
          "SELECT username FROM users WHERE user_id = ?",
          [userId]
        );

        // Notify all players in the lobby with the username
        io.to(lobbyId).emit("user left mid game", { lobbyId, username: user[0]?.username });
      } else {
        // Update the lobby's player list
        const currentPlayers = lobby[0].user_ids.split(",");
        const updatedPlayers = currentPlayers.filter(
          (id) => id !== userId.toString()
        );

        await connection.query(
          "UPDATE lobbies SET user_ids = ? WHERE lobby_id = ?",
          [updatedPlayers.join(","), lobbyId]
        );

        // Notify remaining players
        io.to(lobbyId).emit("player left", {
          lobbyId,
          userId,
          players: updatedPlayers,
        });
      }
    }

    await connection.commit();
    res.json({ message: "Successfully left lobby" });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error leaving lobby:", error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const removePlayer = async (req, res) => {
  const { id: lobbyId } = req.params;
  const { playerId } = req.body;
  const userId = req.user.user_id;
  const io = req.app.get("io");

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get lobby
      const [lobbies] = await connection.execute(
        `
        SELECT l.*, u.username as host_username
        FROM lobbies l
        JOIN users u ON l.lobby_owner = u.user_id
        WHERE l.lobby_id = ?
      `,
        [lobbyId]
      );

      if (lobbies.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: "Lobby not found" });
      }

      const lobby = lobbies[0];

      // Check permissions
      if (lobby.lobby_owner !== userId && req.user.role !== "admin") {
        await connection.rollback();
        connection.release();
        return res
          .status(403)
          .json({ message: "Only hosts and admins can remove players" });
      }

      if (playerId === userId) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ message: "You cannot remove yourself" });
      }

      // Parse user_ids as comma-separated string
      const userIds = lobby.user_ids ? lobby.user_ids.split(",") : [];
      const updatedUserIds = userIds.filter((id) => id !== playerId.toString());

      await connection.execute(
        "UPDATE lobbies SET user_ids = ? WHERE lobby_id = ?",
        [updatedUserIds.join(","), lobbyId]
      );

      // Get updated player information
      const [players] =
        updatedUserIds.length > 0
          ? await connection.execute(
              `SELECT user_id, username FROM users WHERE user_id IN (${updatedUserIds
                .map(() => "?")
                .join(",")})`,
              updatedUserIds
            )
          : [[]];

      await connection.commit();
      connection.release();

      io.to(lobbyId).emit("player left", {
        players: players.map((player) => ({
          id: player.user_id,
          username: player.username,
        })),
      });
      io.to(lobbyId).emit("removed from lobby", { lobbyId, userId: playerId });

      res.json({
        message: "Player removed successfully",
        players: players.map((player) => ({
          id: player.user_id,
          username: player.username,
        })),
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error in removePlayer:", error);
    res
      .status(500)
      .json({ message: "Failed to remove player", error: error.message });
  }
};

const updateLobbySettings = async (req, res) => {
  const { id: lobbyId } = req.params;
  const { name, password, locked, starting_bank, expertiseLevel, buy_in } =
    req.body;
  const userId = req.user.user_id;
  const io = req.app.get("io");

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get lobby
      const [lobbies] = await connection.execute(
        "SELECT * FROM lobbies WHERE lobby_id = ?",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: "Lobby not found" });
      }

      const lobby = lobbies[0];

      // Check if user is host
      if (lobby.lobby_owner !== userId) {
        await connection.rollback();
        connection.release();
        return res
          .status(403)
          .json({ message: "Only hosts can modify lobby settings" });
      }

      // Prepare update values
      const updatedName = name || lobby.lobby_name;
      const updatedLocked = locked !== undefined ? locked : lobby.locked;
      const updatedStartingBank =
        starting_bank !== undefined
          ? parseInt(starting_bank)
          : lobby.starting_bank;
      const updatedExpertiseLevel = expertiseLevel || lobby.expertise_level;

      let updatedPassword = lobby.lobby_password;

      // Only update password if it's explicitly provided or set to null
      if (password !== undefined) {
        updatedPassword = password ? await bcrypt.hash(password, 10) : null;
      }

      // Execute update
      const updateResult = await connection.execute(
        `UPDATE lobbies 
         SET lobby_name = ?, 
             lobby_password = ?, 
             locked = ?, 
             starting_bank = ?,
             expertise_level = ?,
             buy_in = ?
         WHERE lobby_id = ?`,
        [
          updatedName,
          updatedPassword,
          updatedLocked,
          updatedStartingBank,
          updatedExpertiseLevel,
          buy_in,
          lobbyId,
        ]
      );

      // Get updated lobby info
      const [updatedLobbies] = await connection.execute(
        `SELECT l.*, u.username as host_username
         FROM lobbies l
         JOIN users u ON l.lobby_owner = u.user_id
         WHERE l.lobby_id = ?`,
        [lobbyId]
      );

      await connection.commit();
      connection.release();

      const updatedLobby = {
        id: updatedLobbies[0].lobby_id,
        name: updatedLobbies[0].lobby_name,
        hasPassword: !!updatedLobbies[0].lobby_password,
        locked: updatedLobbies[0].locked,
        expertiseLevel: updatedLobbies[0].expertise_level,
        starting_bank: updatedLobbies[0].starting_bank,
        buy_in: updatedLobbies[0].buy_in,
      };

      // Notify all clients in the lobby about the changes
      io.to(lobbyId).emit("lobby settings updated", updatedLobby);

      res.json(updatedLobby);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error in updateLobbySettings:", error);
    res.status(500).json({
      message: "Failed to update lobby settings",
      error: error.message,
    });
  }
};

const startGame = async (req, res) => {
  const lobbyId = req.params.id;
  const io = req.app.get("io");
  const { getRandomCard } = require("../utils/cardUtils");

  try {
    // Get lobby information including buy_in
    const [lobby] = await pool.execute(
      "SELECT lobby_owner, user_ids, starting_bank, buy_in FROM lobbies WHERE lobby_id = ?",
      [lobbyId]
    );

    if (!lobby.length) {
      throw new Error("Lobby not found");
    }

    const players = lobby[0].user_ids.split(",");
    const startingBank = lobby[0].starting_bank || 1000;
    const buyIn = lobby[0].buy_in || 100;
    const potAmount = buyIn * players.length; // Calculate total pot

    // Deal initial cards to each player
    const playerCards = {};
    for (const playerId of players) {
      playerCards[playerId] = {
        cards: [getRandomCard(), getRandomCard()],
      };
    }

    // Store game state
    const [result] = await pool.execute(
      `INSERT INTO game_state (
        lobby_id, 
        current_player_turn,
        current_round,
        pot_amount
      ) VALUES (?, ?, ?, ?)`,
      [lobbyId, 0, 1, potAmount]
    );

    const gameId = result.insertId;

    // Insert player cards with money reduced by buy-in
    for (const playerId of players) {
      await pool.execute(
        `INSERT INTO game_players (
          game_id,
          user_id,
          seat_position,
          cards,
          money,
          is_active,
          stepped_back,
          done_turn
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          playerId,
          players.indexOf(playerId),
          playerCards[playerId].cards.join(","),
          startingBank - buyIn, // Subtract buy-in from starting bank
          true,
          false,
          false,
        ]
      );
    }

    // Update lobby status
    await pool.execute(
      "UPDATE lobbies SET game_started = TRUE, current_game_id = ? WHERE lobby_id = ?",
      [gameId, lobbyId]
    );

    // Create game state for clients
    const gameStateForClients = {
      gameId,
      currentTurn: 0,
      currentRound: 1,
      potAmount,
      players: players.map((playerId) => ({
        id: playerId,
        cards: playerCards[playerId].cards,
        seatPosition: players.indexOf(playerId),
        money: startingBank - buyIn,
        is_active: true,
        stepped_back: false,
        done_turn: false,
      })),
    };

    io.to(lobbyId.toString()).emit("game started", gameStateForClients);
    res.status(200).json({ success: true, gameState: gameStateForClients });
  } catch (error) {
    console.error("Error starting game:", error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createLobby,
  getLobbies,
  getLobby,
  joinLobby,
  leaveLobby,
  removePlayer,
  updateLobbySettings,
  startGame,
};
