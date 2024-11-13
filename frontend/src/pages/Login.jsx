import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import ErrorMessage from "../components/ErrorMessage";

const Login = ({ setUser }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { user, token } = await login(email, password);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      navigate("/");
    } catch (error) {
      console.error("Login failed:", error.message);
      setError("Invalid email or password");
      setTimeout(() => setError(""), 3000); // Clear error after 3 seconds
    }
  };

  return (
    <div className="relative">
      {error && <ErrorMessage message={error} />}
      <form onSubmit={handleSubmit} className="p-8 flex-col flex">
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 p-2 border rounded"
        />
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 p-2 border rounded"
        />
        <button type="submit" className="p-2">
          Login
        </button>
      </form>
    </div>
  );
};
export default Login;
