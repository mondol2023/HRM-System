// src/api/axios.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true, // send HTTP-only cookies
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage as fallback (Bearer)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hrm_token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Auto-redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("hrm_token");
      window.location.href = "/login";
    }
    return Promise.reject(err as Error);
  }
);

export default api;