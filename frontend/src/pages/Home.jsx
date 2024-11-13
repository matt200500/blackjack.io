/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import PasswordModal from "../components/PasswordModal";
import ErrorMessage from "../components/ErrorMessage";

const Home = ({ user }) => {
  const [lobbies, setLobbies] = useState([]);
  const [sortBy, setSortBy] = useState("lobby_id");
  const [sortOrder, setSortOrder] = useState("desc");
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyPassword, setLobbyPassword] = useState("");
  const [expertiseLevel, setExpertiseLevel] = useState("beginner");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedLobbyId, setSelectedLobbyId] = useState(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [includePasswordProtected, setIncludePasswordProtected] =
    useState("all");

  useEffect(() => {
    fetchLobbies();
  }, [sortBy, sortOrder, includePasswordProtected]);

  const fetchLobbies = async () => {
    try {
      const response = await axiosInstance.get(
        `/lobbies?sortBy=${sortBy}&order=${sortOrder}&includePasswordProtected=${includePasswordProtected}`
      );
      setLobbies(response.data);
    } catch (error) {
      console.error("Failed to fetch lobbies:", error);
    }
  };

  const handleCreateLobby = async (e) => {
    e.preventDefault();
    if (lobbyName.trim() && (user?.role === "host" || user?.role === "admin")) {
      try {
        const response = await axiosInstance.post("/lobbies/create", {
          name: lobbyName,
          password: lobbyPassword,
          expertiseLevel,
        });
        console.log(response);
        navigate(`/lobby/${response.data.id}`);
      } catch (error) {
        console.error(
          "Failed to create lobby:",
          error.response?.data?.message || error.message
        );
      }
    }
  };

  const handleJoinLobby = async (lobbyId, hasPassword) => {
    console.log("Joining lobby:", lobbyId, "Has password:", hasPassword);
    if (hasPassword === true) {
      setSelectedLobbyId(lobbyId);
      setIsPasswordModalOpen(true);
    } else {
      await joinLobbyWithPassword(lobbyId, "");
    }
  };

  const joinLobbyWithPassword = async (lobbyId, password) => {
    try {
      const response = await axiosInstance.post(`/lobbies/join/${lobbyId}`, {
        password,
      });
      if (response.data) {
        navigate(`/lobby/${lobbyId}`);
      }
    } catch (error) {
      console.error(
        "Failed to join lobby:",
        error.response?.data?.message || error.message
      );
      setError(error.response?.data?.message || "Failed to join lobby");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handlePasswordSubmit = async (password) => {
    setIsPasswordModalOpen(false);
    if (selectedLobbyId) {
      await joinLobbyWithPassword(selectedLobbyId, password);
    }
  };

  const handleSort = (field) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleFilterChange = (e) => {
    setIncludePasswordProtected(e.target.value);
  };

  return (
    <div className="p-8">
      {error && <ErrorMessage message={error} />}
      <h1 className="text-2xl font-bold mb-4">Welcome to Online Poker</h1>
      {(user?.role === "host" || user?.role === "admin") && (
        <form
          onSubmit={handleCreateLobby}
          className="mb-4 flex flex-col md:flex-row gap-2"
        >
          <input
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder="Enter Lobby Name"
            className="p-2 rounded w-full md:w-auto"
          />
          <input
            type="password"
            value={lobbyPassword}
            onChange={(e) => setLobbyPassword(e.target.value)}
            placeholder="Optional Password"
            className="p-2 rounded w-full md:w-auto"
          />
          <select
            value={expertiseLevel}
            onChange={(e) => setExpertiseLevel(e.target.value)}
            className="p-2 rounded w-full md:w-auto"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full md:w-auto"
          >
            Create
          </button>
        </form>
      )}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">Open Lobbies</h2>
        <div className="mb-4">
          <select
            value={includePasswordProtected}
            onChange={handleFilterChange}
            className="bg-gray-700 text-white p-2 rounded w-fit"
          >
            <option value="all">Any Password</option>
            <option value="yes">Password Protected</option>
            <option value="no">Not Password Protected</option>
          </select>
        </div>
        {lobbies.length === 0 ? (
          <p className="text-gray-400">No open lobbies available.</p>
        ) : (
          <table className="w-full text-left text-white">
            <thead>
              <tr>
                <th
                  className="p-2 cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  Lobby {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="p-2 cursor-pointer"
                  onClick={() => handleSort("host.username")}
                >
                  Host{" "}
                  {sortBy === "host.username" &&
                    (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="p-2 cursor-pointer"
                  onClick={() => handleSort("expertiseLevel")}
                >
                  Expertise{" "}
                  {sortBy === "expertiseLevel" &&
                    (sortOrder === "asc" ? "▲" : "▼")}
                </th>

                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {lobbies.map((lobby) => (
                <tr key={lobby.id} className="bg-gray-700">
                  <td className="p-2">
                    {lobby.name} {lobby.password ? "🔒" : ""}
                  </td>
                  <td className="p-2">{lobby.host.username}</td>
                  <td className="p-2">{lobby.expertiseLevel}</td>

                  <td className="p-2 text-right">
                    {user ? (
                      <button
                        onClick={() =>
                          handleJoinLobby(lobby.id, Boolean(lobby.hasPassword))
                        }
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors duration-200"
                      >
                        Join
                      </button>
                    ) : (
                      <button
                        disabled
                        title="Login to Play!"
                        className="bg-gray-500 text-gray-300 px-3 py-1 rounded cursor-not-allowed"
                      >
                        Join
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedLobbyId(null);
        }}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
};

export default Home;
