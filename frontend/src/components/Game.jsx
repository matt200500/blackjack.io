import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import PropTypes from "prop-types";
import HiddenCard from "./HiddenCard";
import VisibleCard from "./VisibleCard";
import ChatBox from "./ChatBox";

const ChatToggleButton = ({ onClick, isOpen }) => (
  <button
    onClick={onClick}
    className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      )}
    </svg>
  </button>
);

const Game = ({ players, lobby, user }) => {
  const [seats, setSeats] = useState(Array(6).fill(null));
  const [error, setError] = useState("");
  const [gameState, setGameState] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const socketRef = useRef();

  // Add prop validation
  useEffect(() => {
    if (!user || !user.user_id) {
      console.error("User prop is missing or invalid:", user);
      return;
    }
    // ... rest of the code
  }, [user]);

  // Fetch initial game state
  useEffect(() => {
    const fetchGameState = async () => {
      try {
        console.log("Fetching game state for lobby:", lobby.id);
        const response = await fetch(
          `http://localhost:3001/api/lobbies/${lobby.id}/game-state`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        const data = await response.json();
        console.log("Fetched game state:", data);
        if (data.gameState) {
          setGameState(data.gameState);
        }
      } catch (error) {
        console.error("Error fetching game state:", error);
      }
    };

    fetchGameState();
  }, [lobby.id]);

  // Socket connection
  useEffect(() => {
    if (!user) return; // Add safety check

    console.log("Initializing socket connection for lobby:", {
      lobbyId: lobby.id,
      userId: user.user_id,
      username: user.username,
    });

    socketRef.current = io("http://localhost:3001");
    socketRef.current.emit("join lobby", lobby.id);

    socketRef.current.on("connect", () => {
      console.log("Socket connected with ID:", socketRef.current.id);
    });

    socketRef.current.on("game started", (data) => {
      console.log("Game started event received for player:", {
        username: user.username,
        data,
      });
      setGameState(data);
    });

    return () => {
      console.log("Cleaning up socket connection");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [lobby.id, user]); // Add user to dependencies

  // Add another useEffect to log when gameState changes
  useEffect(() => {
    if (gameState) {
      console.log("Game state updated:", {
        username: players.find((p) => p.id === user.user_id)?.username,
        gameState,
      });
    }
  }, [gameState, players, user.user_id]);

  // Add another useEffect to log when gameState changes
  useEffect(() => {
    if (gameState) {
      console.log("Current game state:", {
        gameState,
        players: gameState.players,
        seats,
      });
    }
  }, [gameState, seats]);

  // Assign seats
  useEffect(() => {
    if (players.length < 2 || players.length > 6) {
      setError("Need 2-6 players to start the game");
      return;
    }

    const newSeats = Array(6).fill(null);
    players.forEach((player, index) => {
      newSeats[index] = player;
    });
    setSeats(newSeats);
  }, [players]);

  // Debug render
  if (gameState) {
    console.log("Rendering with game state:", gameState);
    seats.forEach((player, index) => {
      console.log(`Seat ${index}:`, {
        player: player?.username || "empty",
        hasButton: index === gameState.buttonPosition,
        isCurrentTurn: index === gameState.currentTurn,
      });
    });
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 bg-red-500/20 rounded-lg border border-red-500/50">
        {error}
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      {/* Game table - Only show in landscape or on larger screens */}
      <div className="hidden md:block landscape:block relative w-full aspect-[16/9] max-w-7xl bg-green-800/90 rounded-xl border-4 border-gray-800 overflow-hidden">
        {/* Blackjack Table */}
        <div className="absolute inset-8 sm:inset-12 md:inset-16 bg-green-700/80 rounded-[100%] border-4 sm:border-6 md:border-8 border-gray-800">
          {/* Center pot area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-900/30 p-2 sm:p-3 md:p-4 rounded-full">
            <span className="text-white text-sm sm:text-base md:text-lg font-bold whitespace-nowrap">
              Pot: $0
            </span>
          </div>
        </div>

        {/* Seat positions */}
        {seats.map((player, index) => {
          const positions = [
            "bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2",
            "bottom-1/4 left-2 sm:left-4",
            "top-1/3 left-2 sm:left-4",
            "top-2 sm:top-4 left-1/2 -translate-x-1/2",
            "top-1/3 right-2 sm:right-4",
            "bottom-1/4 right-2 sm:right-4",
          ];

          const isCurrentTurn = index === gameState?.currentTurn;
          const playerData = gameState?.players?.find(
            (p) => p.seatPosition === index
          );

          return (
            <div
              key={index}
              className={`absolute ${
                positions[index]
              } w-24 sm:w-32 md:w-40 h-14 sm:h-16 md:h-20 
              ${
                isCurrentTurn
                  ? "ring-4 ring-yellow-400 ring-offset-4 ring-offset-green-800"
                  : ""
              } 
              bg-gray-800/90 rounded-lg border border-gray-700 sm:border-2 p-1 sm:p-2 
              transform transition-all duration-300`}
            >
              {player && (
                <div className="relative flex flex-col items-center justify-center h-full">
                  <div className="absolute -top-14 flex gap-1">
                    {playerData?.cards && (
                      <>
                        <VisibleCard card={playerData.cards[0]} />
                        <HiddenCard />
                      </>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                    <span className="text-base font-bold text-white">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium text-sm truncate max-w-[90%]">
                    {player.username}
                  </span>
                  <span className="text-gray-400 text-xs">$1000</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rotation prompt - Only show on mobile in portrait */}
      <div className="md:hidden portrait:flex landscape:hidden w-full h-full flex items-center justify-center">
        <div className="bg-gray-800/95 rounded-xl p-8 m-4 shadow-lg border border-gray-700 text-center">
          <div className="animate-bounce">
            <svg
              className="w-20 h-20 mx-auto mb-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Please Rotate Your Device
          </h3>
          <p className="text-gray-300">
            For the best gaming experience, please switch to landscape mode
          </p>
        </div>
      </div>

      {/* Chat Toggle Button */}
      <ChatToggleButton
        onClick={() => setIsChatOpen(!isChatOpen)}
        isOpen={isChatOpen}
      />

      {/* Chat Overlay */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-in-out transform ${
          isChatOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-gray-800 border-t border-gray-700 shadow-lg">
          {/* Chat Content */}
          <div className="h-[90vh] lg:h-[50vh] overflow-scroll w-full p-8">
            <ChatBox user={user} lobbyId={lobby.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add prop types validation if you're using PropTypes
Game.propTypes = {
  players: PropTypes.array.isRequired,
  lobby: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
};

export default Game;
