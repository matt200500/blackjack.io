import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import ErrorMessage from "../components/ErrorMessage";
import axiosInstance from "../utils/axiosInstance";
import io from "socket.io-client";
import LobbySettings from "../components/LobbySettings";
import Game from "../components/Game";

const Lobby = ({ user }) => {
  const { id } = useParams();
  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const socketRef = useRef();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameError, setGameError] = useState("");

  const handleLobbyUpdate = useCallback((updatedLobby) => {
    setLobby((prevLobby) => ({
      ...prevLobby,
      ...updatedLobby,
    }));
  }, []);

  const fetchLobby = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`/lobbies/${id}`);
      setLobby(response.data);
      setPlayers(response.data.players);
    } catch (error) {
      console.error("Failed to fetch lobby:", error);
      setError("Failed to fetch lobby");
      setTimeout(() => navigate("/"), 3000);
    }
  }, [id, navigate]);

  useEffect(() => {
    socketRef.current = io("http://localhost:3001");

    // Set up event listeners first
    socketRef.current.on("request players update", (data) => {
      if (data.lobbyId === id) {
        fetchLobby();
      }
    });

    socketRef.current.on("host left lobby", (data) => {
      if (data.lobbyId === id) {
        setError("Host left the lobby!");
        setTimeout(() => navigate("/"), 3000);
      }
    });

    socketRef.current.on("player joined", (data) => {
      setPlayers(data.players);
    });

    socketRef.current.on("player left", (data) => {
      setPlayers(data.players);
    });

    socketRef.current.on("removed from lobby", (data) => {
      if (data.lobbyId === id && data.userId === user.id) {
        setError("You have been removed from the lobby");
        socketRef.current.emit("leave lobby", id);
        setTimeout(() => navigate("/"), 3000);
      } else if (data.lobbyId === id) {
        setPlayers((prevPlayers) =>
          prevPlayers.filter((player) => player.id !== data.userId)
        );
      }
    });

    socketRef.current.on("lobby settings updated", (updatedLobby) => {
      setLobby((prevLobby) => ({
        ...prevLobby,
        ...updatedLobby,
      }));
    });

    socketRef.current.on("game started", () => {
      console.log("Game started event received");
      setGameStarted(true);
    });

    // Join the lobby after setting up listeners
    socketRef.current.emit("join lobby", id);

    // Then fetch initial lobby data
    fetchLobby();

    // Cleanup function
    return () => {
      // If user is host, handle cleanup
      if (lobby?.host?.id === user.id) {
        axiosInstance.post(`/lobbies/leave/${id}`).catch((error) => {
          console.error("Error during host cleanup:", error);
        });
      }

      socketRef.current.off("request players update");
      socketRef.current.off("host left lobby");
      socketRef.current.off("player joined");
      socketRef.current.off("player left");
      socketRef.current.off("removed from lobby");
      socketRef.current.off("lobby settings updated");
      socketRef.current.emit("leave lobby", id);
      socketRef.current.disconnect();
      socketRef.current.off("game started");
    };
  }, [id, navigate, user.id, fetchLobby, lobby?.host?.id]);

  const leaveLobby = async () => {
    try {
      await axiosInstance.post(`/lobbies/leave/${id}`);
      navigate("/");
    } catch (error) {
      console.error(
        "Failed to leave lobby:",
        error.response?.data?.message || error.message
      );
      setError("Failed to leave lobby");
      setTimeout(() => navigate("/"), 3000);
    }
  };

  const removePlayer = async (playerId) => {
    try {
      await axiosInstance.post(`/lobbies/${id}/remove-player`, { playerId });
      // Update the local state to reflect the change
      setPlayers(players.filter((player) => player.id !== playerId));
    } catch (error) {
      console.error(
        "Failed to remove player:",
        error.response?.data?.message || error.message
      );
      setError("Failed to remove player");
      setTimeout(() => setError(""), 3000);
    }
  };

  const startGame = async () => {
    if (players.length < 2 || players.length > 6) {
      setGameError("Need 2-6 players to start the game");
      setTimeout(() => setGameError(""), 3000);
      return;
    }

    try {
      const response = await axiosInstance.post(`/lobbies/${id}/start-game`);
      setGameStarted(true);
      setGameError("");
    } catch (error) {
      console.error("Failed to start game:", error);
      setGameError(error.response?.data?.message || "Failed to start game");
      setTimeout(() => setGameError(""), 3000);
    }
  };

  console.log("Players:", players);

  if (!lobby) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      {error && (
        <div className="fixed inset-0 bg-gray-900/90 flex justify-center items-center z-50">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Main Lobby Container */}
      <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-gray-700 w-full">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              {lobby.name}
            </h1>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              Big blind:&nbsp;
              <span className="text-gray-400">{lobby.big_blind}</span>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Small blind:&nbsp;
              <span className="text-gray-400">{lobby.small_blind}</span>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Starting Bank:&nbsp;
              <span className="text-gray-400">{lobby.starting_bank}</span>
            </h1>
            <div className="flex items-center">
              <span className="text-gray-400">Expertise Level:</span>
              <span
                className={`ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                  lobby.expertiseLevel === "beginner"
                    ? "bg-green-500/20 text-green-400"
                    : lobby.expertiseLevel === "intermediate"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {lobby.expertiseLevel}
              </span>
            </div>
          </div>
          <button
            onClick={leaveLobby}
            className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors duration-200 font-medium"
          >
            Leave
          </button>
        </div>

        {/* Game Section */}
        <div className="mb-6">
          {gameError && (
            <div className="mb-4">
              <ErrorMessage message={gameError} />
            </div>
          )}

          {gameStarted ? (
            <Game players={players} lobby={lobby} user={user} />
          ) : (
            <div className="flex justify-center">
              {(user.role === "host" || user.role === "admin") && (
                <button
                  onClick={startGame}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  Start Game
                </button>
              )}
            </div>
          )}
        </div>

        {/* Settings Section (if host/admin) */}
        {(user.role === "host" || user.role === "admin") && (
          <div className="mb-6">
            <LobbySettings lobby={lobby} onUpdate={handleLobbyUpdate} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Players List */}
          <div className="overflow-hidden">
            <div className="bg-gray-700/50 rounded-lg border border-gray-600 flex flex-col h-full">
              <div className="p-4 border-b border-gray-600">
                <h2 className="text-xl font-bold text-gray-100">Players</h2>
              </div>
              <div className=" overflow-y-auto flex-1">
                {players.filter((player) => player.id !== user.id).length ===
                0 ? (
                  <p className="text-gray-400 text-center py-4">
                    No other players
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {players
                      .filter((player) => player.id !== user.id)
                      .map((player) => (
                        <li
                          key={player.id}
                          className="flex items-center justify-between p-3 rounded bg-gray-600/50 hover:bg-gray-600 transition-colors duration-200"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-500/50 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-200">
                                {player.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-gray-200 font-medium">
                              {player.username}
                            </span>
                          </div>
                          {(user.role === "host" || user.role === "admin") && (
                            <button
                              onClick={() => removePlayer(player.id)}
                              className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors duration-200 text-sm font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-2 h-full">
            <ChatBox user={user} lobbyId={id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
