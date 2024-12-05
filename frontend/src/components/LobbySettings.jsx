import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faLock,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

const LobbySettings = ({ lobby, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState(lobby?.name || "");
  const [password, setPassword] = useState("");
  const [locked, setLocked] = useState(lobby?.locked || false);
  const [error, setError] = useState("");
  const [starting_bank, setStartingBank] = useState(lobby?.starting_bank || "");
  const [expertiseLevel, setExpertiseLevel] = useState(
    lobby?.expertiseLevel || ""
  );
  const [buy_in, setBuyIn] = useState(lobby?.buy_in || "");

  useEffect(() => {
    console.log("Lobby prop:", lobby);
    setName(lobby?.name || "");
    setStartingBank(lobby?.starting_bank || "");
    setExpertiseLevel(lobby?.expertiseLevel || "");
    setLocked(lobby?.locked || false);
    setBuyIn(lobby?.buy_in || "");
  }, [lobby]);

  useEffect(() => {
    if (isEditing) {
      setIsMounted(true);
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
      setTimeout(() => setIsMounted(false), 500);
    }
  }, [isEditing]);

  useEffect(() => {
    const maxBuyIn = Math.floor(starting_bank * 0.25);
    if (buy_in > maxBuyIn) {
      setBuyIn(maxBuyIn);
      setError(`Buy-in automatically adjusted to maximum allowed value (${maxBuyIn})`);
      setTimeout(() => setError(""), 3000);
    }
  }, [starting_bank]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.put(
        `/lobbies/${lobby.id}/settings`,
        {
          name,
          password: password || null,
          starting_bank,
          expertiseLevel,
          locked,
          buy_in,
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

  if (!isMounted) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2 bg-gray-700/50 text-gray-200 px-4 py-2 rounded hover:bg-gray-700 transition-colors duration-200 border border-gray-600"
      >
        <FontAwesomeIcon icon={faGear} className="w-4 h-4" />
        <span className="font-medium">Edit Lobby Settings</span>
      </button>
    );
  }

  return (
    <div
      className={`bg-gray-700/50 rounded-lg shadow-lg border border-gray-600 overflow-hidden transition-all duration-500 ease-out ${
        isVisible ? "opacity-100 max-h-[800px]" : "opacity-0 max-h-0"
      }`}
    >
      <div className="p-4 border-b border-gray-600">
        <h3 className="text-xl font-bold text-gray-100">Lobby Settings</h3>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Lobby Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 rounded bg-gray-800/50 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Password
            <span className="text-gray-400 ml-1 font-normal">
              (leave empty to remove)
            </span>
          </label>
          <div className="relative flex items-center">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 rounded bg-gray-800/50 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
              placeholder="Enter new password"
            />
            <FontAwesomeIcon
              icon={faLock}
              className="absolute right-3 text-gray-400 w-4 h-4"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Expertise Level
          </label>
          <select
            value={expertiseLevel}
            onChange={(e) => setExpertiseLevel(e.target.value)}
            className="p-2 rounded bg-gray-700/50 text-white border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-300">
              Lock Lobby
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600/80 text-gray-200 rounded hover:bg-gray-600 transition-colors duration-200 font-medium"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/80 text-white rounded hover:bg-blue-600 transition-colors duration-200 font-medium"
          >
            <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default LobbySettings;
