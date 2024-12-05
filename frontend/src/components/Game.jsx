import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import PropTypes from "prop-types";
import HiddenCard from "./HiddenCard";
import VisibleCard from "./VisibleCard";
import ChatBox from "./ChatBox";
import axios from "axios";

// use ai to generate function for calculating card total
const calculateCardTotal = (cards) => {
  if (!cards || !Array.isArray(cards)) return 0;

  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === "A") {
      aces++;
    } else if (["K", "Q", "J"].includes(card)) {
      total += 10;
    } else {
      total += parseInt(card);
    }
  }

  for (let i = 0; i < aces; i++) {
    if (total + 11 <= 21) {
      total += 11;
    } else {
      total += 1;
    }
  }

  return total;
};

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

const api = axios.create({
  baseURL: "http://localhost:3001",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  },
});

// Add this to test the API configuration
// console.log("API Configuration:", {
//   baseURL: api.defaults.baseURL,
//   headers: api.defaults.headers,
// });

const Game = ({ players, lobby, user, updateUserStats, socket }) => {
  const [seats, setSeats] = useState(Array(6).fill(null));
  const [error, setError] = useState("");
  const [gameState, setGameState] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [playersActed, setPlayersActed] = useState(new Set());
  const socketRef = useRef();
  const [lastActionRound, setLastActionRound] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [winners, setWinners] = useState([]);
  const [playerStats, setPlayerStats] = useState({});

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
        // console.log("Fetching game state for lobby:", lobby.id);
        const response = await fetch(
          `http://localhost:3001/api/lobbies/${lobby.id}/game-state`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        const data = await response.json();
        // console.log("Fetched game state:", data);
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

    socketRef.current = io("http://localhost:3001");
    socketRef.current.emit("join lobby", lobby.id);

    socketRef.current.on("connect", () => {});

    socketRef.current.on("game started", (data) => {
      setGameState(data);
      setGameEnded(false); // Reset game ended state
      setWinners([]); // Clear previous winners
    });
  }, []);

  // Add another useEffect to log when gameState changes
  useEffect(() => {
    if (gameState) {
      // Add detailed player logging
      gameState.players?.forEach((player, index) => {});
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
    seats.forEach((player, index) => {});
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 bg-red-500/20 rounded-lg border border-red-500/50">
        {error}
      </div>
    );
  }

  const handleSkip = async () => {
    try {
      const currentPlayer = gameState.players?.find((p) => p.id === user.id);

      // Get the token
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const requestData = {
        gameId: lobby.id,
        userId: Number(user.id),
        lobbyId: Number(lobby.id),
        seatPosition: Number(currentPlayer.seatPosition),
      };

      // Include the token in the headers
      const response = await api.post("/api/game/skip", requestData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        if (response.data.gameState) {
          setGameState(response.data.gameState);
          setLastActionRound(response.data.gameState.currentRound);
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.error("Authentication error - try logging in again");
      } else {
        console.error("Skip request failed:", error);
        if (error.response?.data) {
          console.error("Server Error Details:", error.response.data);
        }
      }
    }

    try {
      // Check for game state updates
      const token = localStorage.getItem("token");

      const response = await api.get(
        `/api/game/check-round-status/${gameState.gameId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        }
      );

      if (response.data.success) {
      }
    } catch (error) {
      console.error("Error checking game state:", error);
    }
  };

  const handleHit = async () => {
    try {
      const currentPlayer = gameState.players?.find((p) => p.id === user.id);

      if (!currentPlayer) {
        console.error("Current player not found in game state");
        return;
      }

      const requestData = {
        gameId: lobby.id,
        userId: Number(user.id),
        lobbyId: Number(lobby.id),
        seatPosition: Number(currentPlayer.seatPosition),
      };

      // Assuming you have a function to get the auth token
      const token = localStorage.getItem("token"); // or however you store it

      const response = await api.post("/api/game/hit", requestData, {
        headers: {
          Authorization: `Bearer ${token}`, // Include the token in the headers
        },
      });

      if (response.data.success) {
        if (response.data.gameState) {
          setGameState(response.data.gameState);
          setLastActionRound(response.data.gameState.currentRound);
        }
      }
    } catch (error) {
      console.error("Hit request failed:", error);
      if (error.response && error.response.status === 401) {
        console.error("Authentication error - you may need to log in again");
      }
    }

    try {
      // Check for game state updates
      const token = localStorage.getItem("token");

      const response = await api.get(
        `/api/game/check-round-status/${gameState.gameId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        }
      );

      if (response.data.success) {
      }
    } catch (error) {
      console.error("Error checking game state:", error);
    }
  };

  useEffect(() => {
    socketRef.current.on("game state updated", (updatedGameState) => {
      setGameState(updatedGameState);
    });

    return () => {
      socketRef.current.off("game state updated");
    };
  }, []);

  // Add this new useEffect for polling
  useEffect(() => {
    if (!gameState?.gameId) return;

    const pollInterval = setInterval(async () => {
      try {
        // Log the full URL being called
        const url = `/api/game/check-round-status/${gameState.gameId}`;

        const token = localStorage.getItem("token");

        const response = await api.get(url, {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        });

        if (response.data.success && response.data.roundComplete) {
        }
      } catch (error) {
        console.error("Error polling round status:", error);
        if (error.response) {
          console.error("Error details:", {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          });
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [gameState?.gameId]);

  // Add this useEffect for real-time updates
  useEffect(() => {
    if (!gameState?.gameId) return;

    // Set up polling interval
    const updateInterval = setInterval(async () => {
      try {
        // Poll for game state updates
        const token = localStorage.getItem("token");

        const response = await api.get(
          `/api/game/check-round-status/${gameState.gameId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`, // Include the token in the headers
            },
          }
        );

        if (response.data.success) {
        }
      } catch (error) {
        console.error("Error polling game state:", error);
      }
    }, 1000); // Poll every second

    // Socket listener for game state updates
    socketRef.current.on("game state updated", (updatedGameState) => {
      setGameState(updatedGameState);
    });

    // Cleanup function
    return () => {
      clearInterval(updateInterval);
      socketRef.current.off("game state updated");
    };
  }, [gameState?.gameId]);

  // Add another useEffect to log when gameState changes
  useEffect(() => {
    if (gameState) {
    }
  }, [gameState]);

  const areButtonsDisabled = () => {
    // Get current player's data
    const currentPlayer = gameState?.players?.find((p) => p.id === user.id);

    // Disable if:
    // 1. No game state
    // 2. Not player's turn
    // 3. Player has stepped back
    return (
      !gameState ||
      gameState.currentTurn !== currentPlayer?.seatPosition ||
      currentPlayer?.stepped_back
    );
  };

  // Add this useEffect for continuous polling
  useEffect(() => {
    if (!lobby?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await api.get(`/api/lobbies/${lobby.id}/game-state`, {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        });

        if (response.data.gameState) {
          // Preserve the current round or increment it if certain conditions are met
          setGameState((prevState) => {
            const newState = {
              ...prevState,
              ...response.data.gameState,
              currentRound: prevState?.currentRound || 1, // Preserve existing round or default to 1
              gameId: lobby.id, // Ensure we have the gameId
            };

            // If all players have acted (you'll need to define this logic)
            const allPlayersActed = response.data.gameState.players.every(
              (player) => player.done_turn || !player.is_active
            );

            // If all players have acted, increment the round
            if (allPlayersActed && prevState?.currentRound) {
              newState.currentRound = prevState.currentRound + 1;
            }

            return newState;
          });
        }
      } catch (error) {
        console.error("Error polling game state:", error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [lobby?.id]);

  // Add this useEffect to handle game end
  useEffect(() => {
    if (!socket) return;

    socket.on("game ended", async (data) => {
      console.log("Game ended event received:", data);

      // Immediately set the game end states
      setGameEnded(true);
      setWinners(data.winners || []);
      setPlayerStats((prevStats) => {
        const newStats = { ...prevStats };
        data.updatedPlayers?.forEach((player) => {
          newStats[player.user_id] = {
            wins: player.wins,
            username: player.username,
          };

          // If this is the current user, update their stats in the navbar
          if (player.user_id === user.user_id) {
            updateUserStats({
              wins: player.wins,
              losses: player.losses,
            });
          }
        });
        return newStats;
      });

      // Store the new game state in a variable
      const newGameState = data.newGameState;
      console.log("setting new game state");
      // Use Promise-based timeout for better control
      new Promise((resolve) => setTimeout(resolve, 3000)).then(() => {
        // Only reset states after the delay
        setGameEnded(false);
        setWinners([]);
        if (newGameState) {
          setGameState(newGameState);
        }
      });
    });

    return () => {
      socket.off("game ended");
    };
  }, [socket, user.user_id, updateUserStats]);

  // 1. Move WinnerOverlay outside of the useEffect
  const WinnerOverlay = ({ winners, playerStats }) => {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Winner{winners.length > 1 ? "s" : ""}!
          </h2>
          <div className="space-y-4">
            {winners.map((winner, index) => (
              <div
                key={index}
                className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <span className="text-white font-medium">
                    {playerStats[winner.userId]?.username || "Player"}
                  </span>
                  <p className="text-gray-400 text-sm">Total: {winner.total}</p>
                  <p className="text-green-400 text-sm">
                    Wins: {playerStats[winner.userId]?.wins || 0}
                  </p>
                </div>
                <div className="text-yellow-400 text-4xl">👑</div>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-sm text-center mt-4">
            New game starting...
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex justify-center">
      {/* {console.log("game ended", gameEnded, "winners", winners)} */}
      {gameEnded && winners.length > 0 && (
        <WinnerOverlay winners={winners} playerStats={playerStats} />
      )}

      {/* Game table - Only show in landscape or on larger screens */}
      <div className="hidden md:block landscape:block relative w-full aspect-[16/9] max-w-7xl bg-green-800/90 rounded-xl border-4 border-gray-800 overflow-hidden">
        {/* Blackjack Table */}
        <div className="absolute inset-8 sm:inset-12 md:inset-16 bg-green-700/80 rounded-[100%] border-4 sm:border-6 md:border-8 border-gray-800"></div>

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

          const cardTotal = playerData?.cards
            ? calculateCardTotal(playerData.cards)
            : 0;
          const wins = playerStats[playerData?.id]?.wins || 0;

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
                      <div className="flex gap-1">
                        {/* Show all cards for current user, only first card for others */}
                        {playerData.id === user.id ? (
                          // Current user sees all their cards
                          playerData.cards.map((card, cardIndex) => (
                            <VisibleCard key={cardIndex} card={card} />
                          ))
                        ) : (
                          // Other players' cards are partially hidden
                          <>
                            <VisibleCard card={playerData.cards[0]} />
                            {playerData.cards.slice(1).map((_, cardIndex) => (
                              <HiddenCard key={cardIndex + 1} />
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                    <span className="text-base font-bold text-white">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm max-w-[90%]">
                      {player.username}
                    </span>
                    {playerData?.id === user?.id && cardTotal > 0 && (
                      <span
                        className={`text-xs w-full font-medium ${
                          cardTotal > 21
                            ? "text-red-400"
                            : cardTotal === 21
                            ? "text-green-400"
                            : "text-gray-400"
                        }`}
                      >
                        Total: {cardTotal}
                      </span>
                    )}
                    {playersActed.has(player.user_id) && (
                      <span className="text-xs text-green-400 font-medium">
                        Done Turn
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">Wins: {wins}</span>
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

      {/* Add these buttons just before the Chat Toggle Button */}
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 flex gap-4 z-50">
        <button
          className={`bg-green-600 text-white px-6 py-2 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105
            ${
              areButtonsDisabled()
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-green-700"
            }`}
          onClick={handleHit}
          disabled={areButtonsDisabled()}
        >
          Hit
        </button>
        <button
          className={`bg-red-600 text-white px-6 py-2 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105
            ${
              areButtonsDisabled()
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-700"
            }`}
          onClick={handleSkip}
          disabled={areButtonsDisabled()}
        >
          Skip
        </button>
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
  updateUserStats: PropTypes.func.isRequired,
  socket: PropTypes.object.isRequired,
};

export default Game;
