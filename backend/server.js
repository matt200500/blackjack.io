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
app.use("/api/game", gameRoutes);

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
