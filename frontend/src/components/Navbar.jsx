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
    <nav className="bg-gray-900 p-4 shadow-lg h-16 max-h-16 flex w-full">
      <div className="px-2 flex justify-between items-center w-full">
        <NavLink
          to="/"
          className="text-white hover:text-yellow-400 transition-colors duration-300"
        >
          <h1 className="text-2xl font-extrabold">Poker Online</h1>
        </NavLink>
        <ul className="flex items-center space-x-6">
          {user ? (
            <>
              <li
                className="flex items-center cursor-pointer hover:bg-gray-800 p-2 rounded-xl transition-colors duration-300"
                onClick={handleProfileClick}
              >
                <img
                  src={`/pfps/${user.profilePicture}.png`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full mr-2"
                />
                <span className="text-gray-300">
                  {user.username} ({user.wins}W - {user.losses}L)
                </span>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="text-gray-300 bg-blue-700 text-sm px-2 py-1 hover:text-white"
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login" className="text-gray-300 hover:text-white">
                  Login
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/signup"
                  className="text-gray-300 hover:text-white"
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
