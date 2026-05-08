import { apiClient } from "./apiClient";

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post("/auth/login", { email, password }),
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    apiClient.post("/auth/register", data),
  getMe: () => apiClient.get("/auth/me"),
};
