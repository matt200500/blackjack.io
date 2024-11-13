import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:3001/api",
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.message === "Not authorized, token failed") {
      // Only clear token if it's specifically a token failure
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("tokenExpired"));
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
