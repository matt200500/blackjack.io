const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { pool, connectDB } = require("./utils/db");
const userRoutes = require("./routes/userRoutes");
const lobbyRoutes = require("./routes/lobbyRoutes");
const gameRoutes = require("./routes/gameRoutes");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
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

// Add this before your routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/lobbies", lobbyRoutes);
app.use("/api/game", gameRoutes);

// Add this after your routes to catch 404s
app.use((req, res, next) => {
  console.log("404 Not Found:", req.method, req.url);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
  });
});

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join lobby", (lobbyId) => {
    console.log(`Socket ${socket.id} joining lobby: ${lobbyId}`);
    socket.join(lobbyId);

    // Log all sockets in this room
    const sockets = io.sockets.adapter.rooms.get(lobbyId);
    console.log(
      `Current sockets in lobby ${lobbyId}:`,
      Array.from(sockets || [])
    );
  });

  socket.on("game ended", (data) => {
    console.log(
      "Game ended event received, broadcasting to lobby:",
      data.lobbyId
    );
    io.to(data.lobbyId.toString()).emit("game ended", data);
  });

  socket.on("leave lobby", (lobbyId) => {
    console.log(`User left lobby: ${lobbyId}`);
    socket.leave(lobbyId);
  });

  socket.on("chat message", (messageData) => {
    console.log("Chat message received:", messageData);
    // Broadcast the message to all clients in the specific lobby
    io.to(messageData.lobbyId).emit("chat message", {
      user: messageData.user,
      text: messageData.text,
      profilePicture: messageData.profilePicture,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(`Server running on port ${port}`));
