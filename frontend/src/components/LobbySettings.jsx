import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";

const LobbySettings = ({ lobby, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(lobby?.name || "");
  const [password, setPassword] = useState("");
  const [locked, setLocked] = useState(lobby?.locked || false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(lobby?.name || "");
    setLocked(lobby?.locked || false);
  }, [lobby]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.put(
        `/lobbies/${lobby.id}/settings`,
        {
          name,
          password: password || null,
          locked,
        }
      );
      onUpdate(response.data);
      setIsEditing(false);
      setPassword("");
    } catch (error) {
      setError(
        error.response?.data?.message || "Failed to update lobby settings"
      );
      setTimeout(() => setError(""), 3000);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors duration-200"
      >
        Edit Lobby Settings
      </button>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">Lobby Settings</h3>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Lobby Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Password (leave empty to remove)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white"
            placeholder="Enter new password"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => setLocked(e.target.checked)}
            className="mr-2"
          />
          <label>Lock Lobby</label>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default LobbySettings;
