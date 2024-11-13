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
        "INSERT INTO lobby (lobby_name, lobby_password, expertise_level, lobby_owner, user_ids) VALUES (?, ?, ?, ?, ?)",
        [
          name,
          password ? await bcrypt.hash(password, 10) : null,
          expertiseLevel,
          hostId,
          JSON.stringify([hostId]), // Ensure it's a properly formatted JSON array
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

    // Build the base query with JSON_LENGTH instead of JSON_ARRAY_LENGTH
    let query = `
      SELECT 
        l.lobby_id as id,
        l.lobby_name as name,
        l.expertise_level as expertiseLevel,
        CASE WHEN l.lobby_password IS NOT NULL AND l.lobby_password != '' THEN 1 ELSE 0 END as hasPassword,
        JSON_LENGTH(COALESCE(l.user_ids, '[]')) as playerCount,
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

      // Add player to user_ids if not already present
      let userIds;
      try {
        userIds = JSON.parse(lobby.user_ids);
        if (!Array.isArray(userIds)) {
          userIds = [];
        }
      } catch (error) {
        userIds = [];
      }

      if (!userIds.includes(userId)) {
        userIds.push(userId);
        await connection.execute(
          "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
          [JSON.stringify(userIds), lobbyId]
        );
      }

      // Get updated player information
      const [players] = await connection.execute(
        `
        SELECT user_id, username
        FROM users
        WHERE user_id IN (?)
      `,
        [userIds]
      );

      await connection.commit();
      connection.release();

      io.to(lobbyId).emit("player joined", {
        players: players.map((player) => ({
          id: player.user_id,
          username: player.username,
        })),
      });

      res.json({
        message: "Joined lobby successfully",
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
    console.error("Error in joinLobby:", error);
    console.log(error);
    res
      .status(500)
      .json({ message: "Failed to join lobby", error: error.message });
  }
};

const getLobby = async (req, res) => {
  const { id } = req.params;

  try {
    // Get lobby with host information
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
    const playerIds = JSON.parse(lobby.user_ids);

    // Get player information
    const [players] = await pool.execute(
      `
      SELECT user_id, username
      FROM users
      WHERE user_id IN (?)
    `,
      [playerIds]
    );

    const formattedLobby = {
      id: lobby.lobby_id,
      name: lobby.lobby_name,
      host: {
        id: lobby.lobby_owner,
        username: lobby.host_username,
      },
      expertiseLevel: lobby.expertise_level,
      players: players.map((player) => ({
        id: player.user_id,
        username: player.username,
      })),
    };

    res.json(formattedLobby);
  } catch (error) {
    console.error("Error in getLobby:", error);
    res
      .status(500)
      .json({ message: "Failed to get lobby", error: error.message });
  }
};

const leaveLobby = async (req, res) => {
  const { id: lobbyId } = req.params;
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

      // If user is host, delete the lobby
      if (lobby.lobby_owner === userId) {
        await connection.execute("DELETE FROM lobby WHERE lobby_id = ?", [
          lobbyId,
        ]);
        await connection.commit();
        connection.release();

        io.to(lobbyId).emit("host left lobby", { lobbyId });
        return res.json({ message: "Lobby deleted successfully" });
      }

      // Otherwise, remove user from user_ids
      let userIds;
      try {
        userIds = JSON.parse(lobby.user_ids);
        if (!Array.isArray(userIds)) {
          userIds = [];
        }
      } catch (error) {
        console.error("Error parsing user_ids:", error);
        userIds = [];
      }

      const updatedUserIds = userIds.filter(
        (id) => Number(id) !== Number(userId)
      );

      await connection.execute(
        "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
        [JSON.stringify(updatedUserIds), lobbyId]
      );

      // Get updated player information
      const [players] = await connection.execute(
        `
        SELECT user_id, username
        FROM users
        WHERE user_id IN (?)
      `,
        [updatedUserIds.length > 0 ? updatedUserIds : [0]]
      );

      await connection.commit();
      connection.release();

      io.to(lobbyId).emit("player left", {
        players: players.map((player) => ({
          id: player.user_id,
          username: player.username,
        })),
      });

      res.json({ message: "Left lobby successfully" });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error in leaveLobby:", error);
    res
      .status(500)
      .json({ message: "Failed to leave lobby", error: error.message });
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

      // Remove player from user_ids
      const userIds = JSON.parse(lobby.user_ids);
      const updatedUserIds = userIds.filter((id) => id !== parseInt(playerId));

      await connection.execute(
        "UPDATE lobby SET user_ids = ? WHERE lobby_id = ?",
        [JSON.stringify(updatedUserIds), lobbyId]
      );

      // Get updated player information
      const [players] = await connection.execute(
        `
        SELECT user_id, username
        FROM users
        WHERE user_id IN (?)
      `,
        [updatedUserIds]
      );

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

module.exports = {
  createLobby,
  getLobbies,
  getLobby,
  joinLobby,
  leaveLobby,
  removePlayer,
};
