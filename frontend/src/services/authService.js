import axiosInstance from "../utils/axiosInstance";

export const login = async (email, password) => {
  const response = await axiosInstance.post("/users/login", {
    email,
    password,
  });
  return response.data;
};

export const register = async (username, email, password, role) => {
  const response = await axiosInstance.post("/users/register", {
    username,
    email,
    password,
    role,
  });
  return response.data;
};

// Add this new function to check username availability
export const checkUsernameAvailability = async (username) => {
  const response = await axiosInstance.get(`/users/check-username/${username}`);
  return response.data.isAvailable;
};
