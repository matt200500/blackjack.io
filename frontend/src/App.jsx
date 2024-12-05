import { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import Lobby from "./pages/Lobby";
import ErrorMessage from "./components/ErrorMessage";

const App = () => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [error, setError] = useState("");

  const updateUserStats = useCallback((updatedStats) => {
    console.log("Updated stats:", updatedStats);
    setUser((prevUser) => {
      const newUser = {
        ...prevUser,
        wins: updatedStats.wins || prevUser.wins,
        losses: updatedStats.losses || prevUser.losses,
      };
      localStorage.setItem("user", JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  useEffect(() => {
    const handleTokenExpired = () => {
      setUser(null);
      setError("Your session has expired. Please log in again.");
      setTimeout(() => setError(""), 3000);
    };

    window.addEventListener("tokenExpired", handleTokenExpired);

    return () => {
      window.removeEventListener("tokenExpired", handleTokenExpired);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar user={user} setUser={setUser} handleLogout={handleLogout} />
        <div className="main-content">
          {error && <ErrorMessage message={error} />}
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/signup" element={<SignUp setUser={setUser} />} />
            <Route
              path="/profile"
              element={
                user ? (
                  <Profile user={user} setUser={setUser} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/lobby/:id"
              element={
                user ? (
                  <Lobby user={user} updateUserStats={updateUserStats} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
