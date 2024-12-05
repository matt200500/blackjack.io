/* eslint-disable react/prop-types */
import { NavLink, useNavigate } from "react-router-dom";

const Navbar = ({ user, handleLogout }) => {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    if (user) {
      navigate("/profile");
    } else {
      navigate("/login");
    }
  };

  return (
    <nav className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 shadow-lg h-14 flex items-center w-full sticky-navbar">
      <div className="flex justify-between items-center w-full">
        <NavLink
          to="/"
          className="text-white hover:text-yellow-400 transition-colors duration-300 flex items-center space-x-2"
        >
          <img src="/logo.webp" alt="Blackjack Logo" className="h-8 w-8" />
          <h1 className="text-xl font-extrabold tracking-wider">Blackjack</h1>
        </NavLink>
        <ul className="flex items-center space-x-6">
          {user ? (
            <>
              <li
                className="flex items-center cursor-pointer hover:bg-gray-700/50 py-1.5 px-3 rounded-lg transition-all duration-300 transform hover:scale-105"
                onClick={handleProfileClick}
              >
                <img
                  src={`/pfps/${user.profilePicture}.png`}
                  alt={user.username}
                  className="w-7 h-7 rounded-full mr-2 border-2 border-gray-600"
                />
                <span className="text-gray-200 font-medium text-sm">
                  {user.username}
                </span>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg font-medium transition-colors duration-300 text-sm shadow-md hover:shadow-lg"
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink
                  to="/login"
                  className="text-gray-200 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-700/50 transition-all duration-300"
                >
                  Login
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/signup"
                  className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors duration-300 shadow-md hover:shadow-lg"
                >
                  Sign Up
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
