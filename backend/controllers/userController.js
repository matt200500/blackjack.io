const { pool, connectDB } = require("../utils/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if username or email already exists
      const [existingUsers] = await connection.execute(
        "SELECT username, email FROM users WHERE username = ? OR email = ?",
        [username, email]
      );

      if (existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        if (existingUser.email === email) {
          await connection.rollback();
          connection.release();
          return res
            .status(400)
            .json({ message: "This email is already registered" });
        }
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const [result] = await connection.execute(
        "INSERT INTO users (username, email, password, role, wins, games_played) VALUES (?, ?, ?, ?, 0, 0)",
        [username, email, hashedPassword, role || "user"]
      );

      // Get the created user
      const [users] = await connection.execute(
        "SELECT user_id, username, email, role, wins, games_played, profile_picture FROM users WHERE user_id = ?",
        [result.insertId]
      );

      await connection.commit();
      connection.release();

      const user = users[0];
      const token = jwt.sign(
        { id: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          wins: user.wins,
          gamesPlayed: user.games_played,
          profilePicture: user.profile_picture,
        },
        token,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create user", error: error.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password" });
  }

  try {
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        wins: user.wins,
        gamesPlayed: user.games_played,
        profilePicture: user.profile_picture,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const checkUsername = async (req, res) => {
  const { username } = req.params;
  try {
    const [users] = await pool.execute(
      "SELECT user_id FROM users WHERE username = ?",
      [username]
    );
    res.json({ isAvailable: users.length === 0 });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error checking username", error: error.message });
  }
};

const updateProfilePicture = async (req, res) => {
  const { profilePicture } = req.body;
  const userId = req.user.user_id;

  if (
    !["default", "intermediate", "amateur", "expert"].includes(profilePicture)
  ) {
    return res
      .status(400)
      .json({ message: "Invalid profile picture selection" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE users SET profile_picture = ? WHERE user_id = ?",
      [profilePicture, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const [users] = await pool.execute(
      "SELECT user_id, username, email, role, wins, games_played, profile_picture FROM users WHERE user_id = ?",
      [userId]
    );

    res.json({
      message: "Profile picture updated successfully",
      user: {
        id: users[0].user_id,
        username: users[0].username,
        email: users[0].email,
        role: users[0].role,
        wins: users[0].wins,
        gamesPlayed: users[0].games_played,
        profilePicture: users[0].profile_picture,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update profile picture",
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  const { username, email } = req.body;
  const userId = req.user.user_id;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if the new username is already taken by another user
      if (username !== req.user.username) {
        const [existingUsers] = await connection.execute(
          "SELECT user_id FROM users WHERE username = ? AND user_id != ?",
          [username, userId]
        );
        if (existingUsers.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: "Username is already taken" });
        }
      }

      // Check if the new email is already taken by another user
      if (email !== req.user.email) {
        const [existingUsers] = await connection.execute(
          "SELECT user_id FROM users WHERE email = ? AND user_id != ?",
          [email, userId]
        );
        if (existingUsers.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      // Update user profile
      await connection.execute(
        "UPDATE users SET username = ?, email = ? WHERE user_id = ?",
        [username, email, userId]
      );

      // Get updated user data
      const [users] = await connection.execute(
        "SELECT user_id, username, email, role, wins, games_played, profile_picture FROM users WHERE user_id = ?",
        [userId]
      );

      await connection.commit();
      connection.release();

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = users[0];
      res.json({
        message: "Profile updated successfully",
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          wins: user.wins,
          gamesPlayed: user.games_played,
          profilePicture: user.profile_picture,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update profile", error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT user_id, username, wins, games_played, profile_picture FROM users"
    );
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  checkUsername,
  updateProfilePicture,
  updateProfile,
  getAllUsers,
};
