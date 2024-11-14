import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import ErrorMessage from "../components/ErrorMessage";
import axiosInstance from "../utils/axiosInstance";
import io from "socket.io-client";
import LobbySettings from "../components/LobbySettings";

const Lobby = ({ user }) => {
  const { id } = useParams();
  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const socketRef = useRef();

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

    // Join the lobby after setting up listeners
    socketRef.current.emit("join lobby", id);

    // Then fetch initial lobby data
    fetchLobby();

    return () => {
      socketRef.current.off("request players update");
      socketRef.current.off("host left lobby");
      socketRef.current.off("player joined");
      socketRef.current.off("player left");
      socketRef.current.off("removed from lobby");
      socketRef.current.emit("leave lobby", id);
      socketRef.current.disconnect();
    };
  }, [id, navigate, user.id, fetchLobby]);

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

  console.log("Players:", players);

  if (!lobby) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      {error && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
          <ErrorMessage message={error} />
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">{lobby.name}</h1>
      <p className="text-lg mb-4">Expertise Level: {lobby.expertiseLevel}</p>
      {(user.role === "host" || user.role === "admin") && (
        <div className="mb-4">
          <LobbySettings
            lobby={lobby}
            onUpdate={(updatedLobby) =>
              setLobby((prevLobby) => ({
                ...prevLobby,
                ...updatedLobby,
              }))
            }
          />
        </div>
      )}
      <button
        onClick={leaveLobby}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors duration-200 mb-4"
      >
        Leave Lobby
      </button>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Other Players:</h2>
        <ul>
          {players
            .filter((player) => player.id !== user.id)
            .map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between mb-2"
              >
                <span>{player.username}</span>
                {(user.role === "host" || user.role === "admin") && (
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors duration-200"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
        </ul>
      </div>
      <ChatBox user={user} lobbyId={id} />
    </div>
  );
};

export default Lobby;
