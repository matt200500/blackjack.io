const { pool, connectDB } = require("../utils/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const loginAttempts = new Map(); // tracks login attempts
const maxAttempts = 3; // max login attempts

// handles login attempts and blocks login ability for account if max attempts reached
const handleLoginAttempt = (email) => {
  const attempts = loginAttempts.get(email) || {count: 0, lockUntil: null};
  
  // checks if account is still locked
  if (attempts.lockUntil && attempts.lockUntil > Date.now()) {
    const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 1000);  // calculates seconds remaining
    throw new Error(`Account is locked. Try again in ${remainingTime} seconds`);
  }
  attempts.count += 1; // otherwise increments login attempts
  
  // compares current attempts to max attempts
  if (attempts.count >= maxAttempts) {
    // lock account for 60 secs and reset attempts
    attempts.lockUntil = Date.now() + (60 * 1000);
    attempts.count = 0;
    loginAttempts.set(email, attempts);
    throw new Error('Login for this account is locked. Try again in 60 seconds');
  }
  loginAttempts.set(email, attempts);
  return maxAttempts - attempts.count; // returns remaining attempts
};

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
        "INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES (?, ?, ?, ?, 0, 0, 0, 'default')",
        [username, email, hashedPassword, role || "user"]
      );

      // Get the created user
      const [users] = await connection.execute(
        "SELECT user_id, username, email, role, wins, losses, games_played, profile_picture FROM users WHERE user_id = ?",
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
          losses: user.losses,
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
    console.log(error);
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
    // check to see if account is locked and for how long
    const existingAttempts = loginAttempts.get(email);
    if (existingAttempts?.lockUntil && existingAttempts.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((existingAttempts.lockUntil - Date.now()) / 1000);
      return res.status(429).json({message: `Login for this account is locked. Try again in ${remainingTime} seconds`});
    }
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

    // check if account exists in db
    if (users.length === 0) {
      const remainingAttempts = handleLoginAttempt(email);
      return res.status(400).json({message: `Invalid email or password. ${remainingAttempts} attempts remaining.`});
    }
    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // check if password is valid and handle login attempts
    if (!isPasswordValid) {
      try {
        const remainingAttempts = handleLoginAttempt(email);
        return res.status(400).json({message: `Incorrect password. ${remainingAttempts} attempts remaining.`}); // return 400 for wrong password
      } catch (error) { 
        return res.status(429).json({message: error.message});  // return 429 for too many wrong attempts
      }
    }
    loginAttempts.delete(email); // reset attempts after logging in

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
        losses: user.losses,
        gamesPlayed: user.games_played,
        profilePicture: user.profile_picture,
      },
      token,
    });
  } catch (error) {
    console.log(error);
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
      "SELECT user_id, username, email, role, wins, losses, games_played, profile_picture FROM users WHERE user_id = ?",
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
        losses: users[0].losses,
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
        "SELECT user_id, username, email, role, wins, losses, games_played, profile_picture FROM users WHERE user_id = ?",
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
          losses: user.losses,
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
      "SELECT user_id, username, wins, losses, games_played, profile_picture FROM users"
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
