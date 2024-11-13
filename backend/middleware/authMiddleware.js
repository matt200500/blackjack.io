const jwt = require("jsonwebtoken");
const { pool } = require("../utils/db");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (using MySQL instead of MongoDB)
      const [users] = await pool.execute(
        "SELECT user_id, username, email, role, wins, losses, games_played, profile_picture FROM users WHERE user_id = ?",
        [decoded.id]
      );

      if (users.length === 0) {
        return res
          .status(401)
          .json({ message: "Not authorized, user not found" });
      }

      // Attach user to request object
      req.user = users[0];

      next();
    } catch (error) {
      console.error("Error in auth middleware:", error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };
