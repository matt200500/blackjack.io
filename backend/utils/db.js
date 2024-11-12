const mysql = require("mysql2/promise");
require("dotenv").config();

const createPool = () => {
  return mysql.createPool({
    host: process.env.DB_HOST || "database",
    user: "root",
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE || "my_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};

const connectWithRetry = async (retries = 5, delay = 5000) => {
  const pool = createPool();

  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log("Database connected successfully");
      connection.release();
      return pool;
    } catch (err) {
      console.error(
        `Attempt ${i + 1}/${retries} - Database connection failed:`,
        err.message
      );
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const pool = createPool();

const connectDB = async () => {
  try {
    await connectWithRetry();
    return pool;
  } catch (err) {
    console.error("Error connecting to the database:", err);
    throw err;
  }
};

module.exports = { pool, connectDB };
