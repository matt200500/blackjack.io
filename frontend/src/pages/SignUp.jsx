/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register, checkUsernameAvailability } from "../services/authService";
import debounce from "lodash/debounce";
import ErrorMessage from "../components/ErrorMessage";

const SignUp = ({ setUser }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("player");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const debouncedCheckUsername = debounce(async (username) => {
    if (username.length > 0) {
      setIsCheckingUsername(true);
      const available = await checkUsernameAvailability(username);
      setIsUsernameAvailable(available);
      setIsCheckingUsername(false);
    } else {
      setIsUsernameAvailable(true);
    }
  }, 300);

  useEffect(() => {
    debouncedCheckUsername(username);
    return () => debouncedCheckUsername.cancel();
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isUsernameAvailable) {
      return;
    }
    try {
      const { user, token } = await register(username, email, password, role);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      navigate("/");
    } catch (error) {
      console.error(
        "SignUp failed:",
        error.response?.data?.message || error.message
      );
      setError(error.response?.data?.message || "SignUp failed");
      setTimeout(() => setError(""), 3000); // Clear error after 3 seconds
    }
  };

  return (
    <div className="relative">
      {error && <ErrorMessage message={error} />}
      <form onSubmit={handleSubmit} className="p-8 flex-col flex">
        <label>Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className={`mb-2 ${!isUsernameAvailable ? "border-red-500" : ""}`}
        />
        {isCheckingUsername && (
          <p className="text-gray-500">Checking username...</p>
        )}
        {!isUsernameAvailable && (
          <p className="text-red-500">Username is already taken</p>
        )}
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label>Role:</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="player">Player</option>
          <option value="host">Host</option>
        </select>
        <button
          type="submit"
          className="p-2 mt-4"
          disabled={!isUsernameAvailable}
        >
          Sign Up
        </button>
      </form>
    </div>
  );
};

export default SignUp;
