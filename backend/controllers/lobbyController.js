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
        `INSERT INTO lobby (
          lobby_name, 
          lobby_password, 
          expertise_level, 
          lobby_owner, 
          user_ids,
          big_blind,
          small_blind,
          starting_bank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          password ? await bcrypt.hash(password, 10) : null,
          expertiseLevel,
          hostId,
          hostId.toString(),
          10.0,
          5.0,
          1000.0,
        ]
      );

      // Get the created lobby with player information
      const [lobbies] = await connection.execute(
        `
        SELECT l.*, u.username as host_username
        FROM lobby l
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
        big_blind: parseFloat(lobby.big_blind || 10).toFixed(2),
        small_blind: parseFloat(lobby.small_blind || 5).toFixed(2),
        starting_bank: parseFloat(lobby.starting_bank || 1000).toFixed(2),
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
      FROM lobby l
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
        "SELECT * FROM lobby WHERE lobby_id = ?",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: "Lobby not found" });
      }

      const lobby = lobbies[0];

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
          "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
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
      FROM lobby l
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
      big_blind: parseFloat(lobby.big_blind || 10).toFixed(2),
      small_blind: parseFloat(lobby.small_blind || 5).toFixed(2),
      starting_bank: parseFloat(lobby.starting_bank || 1000).toFixed(2),
      players: players.map((player) => ({
        id: player.user_id,
        username: player.username,
      })),
    };

    // Debug logs
    console.log("Raw lobby data:", lobby);
    console.log("Formatted lobby data:", formattedLobby);

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

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get current lobby state
      const [lobbies] = await connection.execute(
        "SELECT user_ids, lobby_owner FROM lobby WHERE lobby_id = ?",
        [lobbyId]
      );

      if (!lobbies.length) {
        throw new Error("Lobby not found");
      }

      const lobby = lobbies[0];
      const isHost = lobby.lobby_owner === userId;

      if (isHost) {
        // If host is leaving, delete the lobby and notify all users
        await connection.execute("DELETE FROM lobby WHERE lobby_id = ?", [
          lobbyId,
        ]);

        // Notify all users in the lobby that the host left
        io.to(lobbyId).emit("host left lobby", {
          message: "Host has left the lobby",
          lobbyId,
        });

        // Disconnect all sockets from this room
        const room = io.sockets.adapter.rooms.get(lobbyId.toString());
        if (room) {
          for (const socketId of room) {
            io.sockets.sockets.get(socketId)?.leave(lobbyId);
          }
        }
      } else {
        // Regular player leaving
        let userIds = lobby.user_ids ? lobby.user_ids.split(",") : [];
        userIds = userIds.filter((id) => id !== userId.toString());

        await connection.execute(
          "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
          [userIds.join(","), lobbyId]
        );

        // Notify remaining players about the leave
        io.to(lobbyId).emit("player left", {
          userId,
          remainingPlayers: userIds,
        });
      }

      await connection.commit();
      res.status(200).json({
        message: "Successfully left lobby",
        wasHost: isHost,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error leaving lobby:", error);
    res.status(500).json({ message: error.message });
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
        FROM lobby l
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
        "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
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
  const { name, password, locked, big_blind, starting_bank } = req.body;
  const userId = req.user.user_id;
  const io = req.app.get("io");

  console.log("LOBBY UPDATE - Received request:", {
    lobbyId,
    big_blind,
    starting_bank,
    body: req.body,
  });

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get lobby
      const [lobbies] = await connection.execute(
        "SELECT * FROM lobby WHERE lobby_id = ?",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: "Lobby not found" });
      }

      const lobby = lobbies[0];
      console.log("LOBBY UPDATE - Current state:", {
        big_blind: lobby.big_blind,
        small_blind: lobby.small_blind,
      });

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
      const updatedBigBlind =
        big_blind !== undefined
          ? parseFloat(big_blind)
          : parseFloat(lobby.big_blind);
      const updatedSmallBlind = updatedBigBlind / 2;
      const updatedStartingBank =
        starting_bank !== undefined
          ? parseFloat(starting_bank)
          : parseFloat(lobby.starting_bank);

      console.log("LOBBY UPDATE - New values:", {
        big_blind: updatedBigBlind,
        small_blind: updatedSmallBlind,
      });

      let updatedPassword = lobby.lobby_password;

      // Only update password if it's explicitly provided or set to null
      if (password !== undefined) {
        updatedPassword = password ? await bcrypt.hash(password, 10) : null;
      }

      // Execute update
      const updateResult = await connection.execute(
        `UPDATE lobby 
         SET lobby_name = ?, 
             lobby_password = ?, 
             locked = ?, 
             big_blind = ?, 
             small_blind = ?,
             starting_bank = ?
         WHERE lobby_id = ?`,
        [
          updatedName,
          updatedPassword,
          updatedLocked,
          updatedBigBlind,
          updatedSmallBlind,
          updatedStartingBank,
          lobbyId,
        ]
      );

      console.log("LOBBY UPDATE - Update result:", updateResult);

      // Get updated lobby info
      const [updatedLobbies] = await connection.execute(
        `SELECT l.*, u.username as host_username
         FROM lobby l
         JOIN users u ON l.lobby_owner = u.user_id
         WHERE l.lobby_id = ?`,
        [lobbyId]
      );

      console.log("LOBBY UPDATE - Database values after update:", {
        big_blind: updatedLobbies[0].big_blind,
        small_blind: updatedLobbies[0].small_blind,
      });

      await connection.commit();
      connection.release();

      const updatedLobby = {
        id: updatedLobbies[0].lobby_id,
        name: updatedLobbies[0].lobby_name,
        hasPassword: !!updatedLobbies[0].lobby_password,
        locked: updatedLobbies[0].locked,
        expertiseLevel: updatedLobbies[0].expertise_level,
        big_blind: parseFloat(updatedLobbies[0].big_blind).toFixed(2),
        small_blind: parseFloat(updatedLobbies[0].small_blind).toFixed(2),
        starting_bank: parseFloat(updatedLobbies[0].starting_bank).toFixed(2),
      };

      console.log("LOBBY UPDATE - Final response:", updatedLobby);

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
  const userId = req.user.user_id;
  const io = req.app.get("io");

  try {
    const [lobby] = await pool.execute(
      "SELECT lobby_owner, user_ids FROM lobby WHERE lobby_id = ?",
      [lobbyId]
    );

    if (!lobby.length) {
      throw new Error("Lobby not found");
    }

    const players = lobby[0].user_ids.split(",");
    console.log("Starting game with players:", players);

    // Calculate positions
    const buttonPosition = Math.floor(Math.random() * players.length);
    const smallBlindPosition = (buttonPosition + 1) % players.length;
    const bigBlindPosition = (buttonPosition + 2) % players.length;
    const firstToAct = (bigBlindPosition + 1) % players.length;

    const gameState = {
      buttonPosition,
      smallBlindPosition,
      bigBlindPosition,
      currentTurn: firstToAct,
    };

    console.log("Game state to broadcast:", gameState);

    // Log room info before emit
    const room = io.sockets.adapter.rooms.get(lobbyId.toString());
    console.log(
      `Broadcasting to lobby ${lobbyId}, connected sockets:`,
      Array.from(room || [])
    );

    // Broadcast to room
    io.to(lobbyId.toString()).emit("game started", gameState);

    // Store game state in database
    const [result] = await pool.execute(
      `INSERT INTO game_state (
        lobby_id, 
        button_position, 
        current_player_turn,
        current_round
      ) VALUES (?, ?, ?, ?)`,
      [lobbyId, buttonPosition, firstToAct, "preflop"]
    );

    // Update lobby status
    await pool.execute(
      "UPDATE lobby SET game_started = TRUE, current_game_id = ? WHERE lobby_id = ?",
      [result.insertId, lobbyId]
    );

    res.status(200).json({ success: true, gameState });
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
