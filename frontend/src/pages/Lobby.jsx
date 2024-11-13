import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import ErrorMessage from "../components/ErrorMessage";
import axiosInstance from "../utils/axiosInstance";
import io from "socket.io-client";

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
    fetchLobby();
  }, [fetchLobby]);

  useEffect(() => {
    if (lobby) {
      console.log("Lobby:", lobby);
      console.log("Current user:", user);
      console.log("Is current user the host?", lobby.host._id === user._id);
    }
  }, [lobby, user]);

  useEffect(() => {
    socketRef.current = io("http://localhost:3001");

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
      console.log(data.lobbyId, id, data.userId, user.id);
      if (data.lobbyId === id && data.userId === user.id) {
        setError("You have been removed from the lobby");
        socketRef.current.emit("leave lobby", id);
        setTimeout(() => navigate("/"), 3000);
      } else if (data.lobbyId === id) {
        // Update the players list for other users in the lobby
        setPlayers((prevPlayers) =>
          prevPlayers.filter((player) => player._id !== data.userId)
        );
      }
    });

    socketRef.current.emit("join lobby", id);

    return () => {
      socketRef.current.off("host left lobby");
      socketRef.current.off("player joined");
      socketRef.current.off("player left");
      socketRef.current.off("removed from lobby");
      socketRef.current.emit("leave lobby", id);
      socketRef.current.disconnect();
    };
  }, [id, navigate, user._id]);

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
      setPlayers(players.filter((player) => player._id !== playerId));
    } catch (error) {
      console.error(
        "Failed to remove player:",
        error.response?.data?.message || error.message
      );
      setError("Failed to remove player");
      setTimeout(() => setError(""), 3000);
    }
  };

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
            .filter((player) => player._id !== user._id)
            .map((player) => (
              <li
                key={player._id}
                className="flex items-center justify-between mb-2"
              >
                <span>{player.username}</span>
                {(user.role === "host" || user.role === "admin") && (
                  <button
                    onClick={() => removePlayer(player._id)}
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
