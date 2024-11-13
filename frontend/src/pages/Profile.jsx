import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrophy,
  faSkull,
  faMedal,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { checkUsernameAvailability } from "../services/authService";
import debounce from "lodash/debounce";
import ErrorMessage from "../components/ErrorMessage";

const Profile = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [selectedPicture, setSelectedPicture] = useState(
    user?.profilePicture || "default"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({ ...user });
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handlePictureChange = async (newPicture) => {
    if (!isPictureUnlocked(newPicture)) return;

    try {
      const response = await axiosInstance.put(
        "/users/update-profile-picture",
        { profilePicture: newPicture }
      );
      const updatedUser = response.data.user;
      setUser(updatedUser);
      setSelectedPicture(newPicture);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Failed to update profile picture:", error);
      setError("Failed to update profile picture");
    }
  };

  const isPictureUnlocked = (picture) => {
    const wins = user.wins;
    switch (picture) {
      case "default":
        return true;
      case "amateur":
        return wins >= 1;
      case "intermediate":
        return wins >= 3;
      case "expert":
        return wins >= 5;
      default:
        return false;
    }
  };

  const getUnlockMessage = (picture) => {
    switch (picture) {
      case "amateur":
        return "1 win";
      case "intermediate":
        return "3 wins";
      case "expert":
        return "5 wins";
      default:
        return "";
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setEditedUser({ ...user });
    setIsUsernameAvailable(true);
    setError("");
  };

  const debouncedCheckUsername = debounce(async (username) => {
    if (username.length > 0 && username !== user.username) {
      setIsCheckingUsername(true);
      const available = await checkUsernameAvailability(username);
      setIsUsernameAvailable(available);
      setIsCheckingUsername(false);
    } else {
      setIsUsernameAvailable(true);
    }
  }, 300);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedUser({ ...editedUser, [name]: value });
    if (name === "username") {
      debouncedCheckUsername(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isUsernameAvailable) return;

    try {
      const response = await axiosInstance.put(
        "/users/update-profile",
        editedUser
      );
      setUser(response.data.user);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      setIsEditing(false);
      setError("");
    } catch (error) {
      console.error("Failed to update profile:", error);
      setError(error.response?.data?.message || "Failed to update profile");
    }
  };

  if (!user) {
    return null;
  }

  const profilePictures = ["default", "amateur", "intermediate", "expert"];

  return (
    <div className="mx-auto mt-8 p-4 max-w-4xl">
      <div className="bg-gray-800 shadow-md rounded-lg p-6">
        {error && <ErrorMessage message={error} />}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Your Profile</h2>
          <button
            onClick={handleEditToggle}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors duration-200"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:space-x-8">
          <div className="mb-6 md:mb-0">
            <img
              src={`/pfps/${selectedPicture}.png`}
              alt={user.username}
              className="w-48 h-48 rounded-full mx-auto mb-4 border-4 border-blue-500"
            />
            <div className="flex justify-center mb-4">
              {profilePictures.map((pic) => (
                <div key={pic} className="relative mx-2">
                  <img
                    src={`/pfps/${pic}.png`}
                    alt={pic}
                    className={`w-12 h-12 rounded-full cursor-pointer 
                      ${
                        selectedPicture === pic
                          ? "border-4 border-blue-500"
                          : ""
                      }
                      ${
                        !isPictureUnlocked(pic)
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    onClick={() => handlePictureChange(pic)}
                  />
                  {!isPictureUnlocked(pic) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faLock}
                        className="text-white text-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex-grow">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={editedUser.username}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white ${
                      !isUsernameAvailable ? "border-red-500" : ""
                    }`}
                  />
                  {isCheckingUsername && (
                    <p className="text-sm text-gray-400">
                      Checking username...
                    </p>
                  )}
                  {!isUsernameAvailable && (
                    <p className="text-sm text-red-500">
                      Username is already taken
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={editedUser.email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors duration-200"
                  disabled={!isUsernameAvailable}
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-xl text-white">
                  <span className="font-bold">Username:</span> {user.username}
                </p>
                <p className="text-xl text-white">
                  <span className="font-bold">Email:</span> {user.email}
                </p>
                <p className="text-xl text-white">
                  <span className="font-bold">Role:</span> {user.role}
                </p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faTrophy}
                      className="text-yellow-400 mr-2"
                    />
                    <span className="text-xl text-white">{user.wins} Wins</span>
                  </div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faSkull}
                      className="text-red-500 mr-2"
                    />
                    <span className="text-xl text-white">
                      {user.losses} Losses
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Achievements
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {["amateur", "intermediate", "expert"].map((level) => (
                      <div
                        key={level}
                        className={`p-3 rounded-lg ${
                          isPictureUnlocked(level)
                            ? "bg-green-600"
                            : "bg-gray-700"
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={isPictureUnlocked(level) ? faMedal : faLock}
                          className={`mr-2 ${
                            isPictureUnlocked(level)
                              ? "text-yellow-400"
                              : "text-gray-500"
                          }`}
                        />
                        <span
                          className={`capitalize ${
                            isPictureUnlocked(level)
                              ? "text-white"
                              : "text-gray-400"
                          }`}
                        >
                          {level} Player
                        </span>
                        {!isPictureUnlocked(level) && (
                          <span className="text-sm text-gray-400 ml-2">
                            ({getUnlockMessage(level)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
