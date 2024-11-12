const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { pool, connectDB } = require("./utils/db");
const userRoutes = require("./routes/userRoutes");
const lobbyRoutes = require("./routes/lobbyRoutes");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Connect to MongoDB
connectDB();

// Make io accessible to our router
app.set("io", io);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/lobbies", lobbyRoutes);

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join lobby", (lobbyId) => {
    socket.join(lobbyId);
    console.log(`User joined lobby: ${lobbyId}`);
  });

  socket.on("leave lobby", (lobbyId) => {
    socket.leave(lobbyId);
    console.log(`User left lobby: ${lobbyId}`);
  });

  socket.on("chat message", (msg) => {
    io.to(msg.lobbyId).emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(`Server running on port ${port}`));
