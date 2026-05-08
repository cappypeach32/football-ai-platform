import { apiClient } from "./apiClient";

export const leaguesService = {
  getAll: (activeOnly = true) => apiClient.get("/leagues/", { params: { active_only: activeOnly } }),
};
