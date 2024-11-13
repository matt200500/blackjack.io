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
      console.log("Lobbies:", response.data);
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
    <div className="w-full mx-auto p-4 sm:p-6 lg:p-8">
      {error && <ErrorMessage message={error} />}
      <h1 className="text-3xl font-bold mb-6 text-gray-100">
        Welcome to Online Poker
      </h1>

      {(user?.role === "host" || user?.role === "admin") && (
        <form
          onSubmit={handleCreateLobby}
          className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-100">
            Create New Lobby
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder="Enter Lobby Name"
              className="p-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              value={lobbyPassword}
              onChange={(e) => setLobbyPassword(e.target.value)}
              placeholder="Optional Password"
              className="p-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={expertiseLevel}
              onChange={(e) => setExpertiseLevel(e.target.value)}
              className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors duration-200 font-semibold"
            >
              Create Lobby
            </button>
          </div>
        </form>
      )}

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-100 w-full">
            Open Lobbies
          </h2>
          <select
            value={includePasswordProtected}
            onChange={handleFilterChange}
            className="bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Any Password</option>
            <option value="yes">Password Protected</option>
            <option value="no">Not Password Protected</option>
          </select>
        </div>

        {lobbies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No open lobbies available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-gray-100">
              <thead className="bg-gray-700">
                <tr>
                  <th
                    className="p-4 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleSort("name")}
                  >
                    Lobby{" "}
                    {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleSort("host.username")}
                  >
                    Host{" "}
                    {sortBy === "host.username" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleSort("expertiseLevel")}
                  >
                    Expertise{" "}
                    {sortBy === "expertiseLevel" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {lobbies.map((lobby) => (
                  <tr
                    key={lobby.id}
                    className="hover:bg-gray-700 transition-colors duration-200"
                  >
                    <td className="p-4">
                      {lobby.name}{" "}
                      {lobby.password && (
                        <span className="text-yellow-500">🔒</span>
                      )}
                    </td>
                    <td className="p-4">{lobby.host.username}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-sm ${
                          lobby.expertiseLevel === "beginner"
                            ? "bg-green-500/20 text-green-400"
                            : lobby.expertiseLevel === "intermediate"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {lobby.expertiseLevel}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {user ? (
                        <button
                          onClick={() =>
                            handleJoinLobby(
                              lobby.id,
                              Boolean(lobby.hasPassword)
                            )
                          }
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
                        >
                          Join
                        </button>
                      ) : (
                        <button
                          disabled
                          title="Login to Play!"
                          className="bg-gray-600 text-gray-400 px-4 py-2 rounded cursor-not-allowed"
                        >
                          Join
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
