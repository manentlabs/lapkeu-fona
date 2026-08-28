import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.DEV ? "http://localhost:5000/api" : "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("kmhs_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;