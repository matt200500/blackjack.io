import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import PropTypes from "prop-types";

const Game = ({ players, lobby, user }) => {
  const [seats, setSeats] = useState(Array(6).fill(null));
  const [error, setError] = useState("");
  const [gameState, setGameState] = useState(null);
  const [betAmount, setBetAmount] = useState(0);

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

  const handleAction = (actionType, amount = null) => {
    if (!socketRef.current || !gameState) return;

    console.log(`Player ${user.username} attempting ${actionType}`, amount);
    socketRef.current.emit('player_action', {
      action: actionType,
      amount: amount,
      gameId: gameState.gameId,
      userId: user.user_id
    });
  };

  const renderActionButtons = () => {
    // Only show buttons if it's the current player's turn
    const currentPlayerIndex = seats.findIndex(seat => seat?.user_id === user.user_id);
    const isPlayerTurn = gameState?.currentTurn === currentPlayerIndex;

    if (!isPlayerTurn) {
      return null;
    }

    return (
      <div className="fixed bottom-2 right-4 flex gap-2 z-50 bg-gray-800/90 p-4 rounded-lg shadow-xl">
        <button
          onClick={() => handleAction('fold')}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-colors"
        >
          Fold
        </button>
        
        <button
          onClick={() => handleAction('call')}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors"
        >
          Call
        </button>

        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-24 px-3 py-2 bg-gray-700 text-white rounded-lg"
          placeholder="Bet amount"
        />
        <button
          onClick={() => handleAction('raise', betAmount)}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition-colors"
        >
          Raise
        </button>
      </div>
    );
  };

  // Debug render
  if (gameState) {
    console.log("Rendering with game state:", gameState);
    seats.forEach((player, index) => {
      console.log(`Seat ${index}:`, {
        player: player?.username || "empty",
        hasButton: index === gameState.buttonPosition,
        isSmallBlind: index === gameState.smallBlindPosition,
        isBigBlind: index === gameState.bigBlindPosition,
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
    <div className="relative w-full max-h-[100dvh] flex items-center justify-center">
      {/* Rotation prompt for portrait mode */}
      <div className="md:hidden absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 portrait:flex landscape:hidden">
        <div className="text-center p-6">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-white animate-bounce"
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
          <p className="text-white text-lg font-medium">
            Please rotate your device to landscape mode
          </p>
        </div>
      </div>

      {/* Game table */}
      <div className="relative w-full aspect-[16/9] max-w-7xl bg-green-800/90 rounded-xl border-4 border-gray-800 overflow-hidden portrait:hidden landscape:block">
        {/* Poker Table */}
        <div className="absolute inset-8 sm:inset-12 md:inset-16 bg-green-700/80 rounded-[100%] border-4 sm:border-6 md:border-8 border-gray-800">
          {/* Center pot and cards area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
            {/* Community Cards */}
            <div className="flex gap-2">
              {gameState?.communityCards?.map((card, index) => (
                <div
                  key={index}
                  className="w-10 h-14 sm:w-12 sm:h-16 md:w-14 md:h-20 bg-white rounded-lg shadow-lg flex items-center justify-center"
                >
                  {card ? (
                    <span className={`text-${card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'}-600 font-bold`}>
                      {card.rank}{card.suit}
                    </span>
                  ) : (
                    <div className="w-full h-full bg-blue-800 rounded-lg" /> // Card back
                  )}
                </div>
              ))}
            </div>
            
            {/* Pot Amount */}
            <div className="bg-green-900/30 p-2 sm:p-3 md:p-4 rounded-full">
              <span className="text-white text-sm sm:text-base md:text-lg font-bold whitespace-nowrap">
                Pot: ${gameState?.pot || 0}
              </span>
            </div>
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

          const hasButton = index === gameState?.buttonPosition;
          const isSmallBlind = index === gameState?.smallBlindPosition;
          const isBigBlind = index === gameState?.bigBlindPosition;
          const isCurrentTurn = index === gameState?.currentTurn;

          console.log(`Seat ${index}:`, {
            player: player?.username || "empty",
            hasButton,
            isSmallBlind,
            isBigBlind,
            isCurrentTurn,
          });

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
              {player ? (
                <div className="relative flex flex-col items-center justify-center h-full">
                  {/* Make position indicators more prominent */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 flex gap-1.5">
                    {hasButton && (
                      <span className="bg-white text-black text-xs px-2 py-0.5 rounded-full font-bold shadow-lg">
                        BTN
                      </span>
                    )}
                    {isSmallBlind && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg">
                        SB
                      </span>
                    )}
                    {isBigBlind && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg">
                        BB
                      </span>
                    )}
                  </div>

                  {/* Add current turn indicator */}
                  {isCurrentTurn && (
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                      <span className="animate-bounce inline-block">
                        <svg
                          className="w-6 h-6 text-yellow-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  )}

                  {/* Rest of the player content */}
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                    <span className="text-base font-bold text-white">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium text-sm truncate max-w-[90%]">
                    {player.username}
                  </span>
                  <span className="text-gray-400 text-xs">
                    ${player.money_amount}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-500 text-xs">Empty</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons outside the table */}
      {renderActionButtons()}
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
