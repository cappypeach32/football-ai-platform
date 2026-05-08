import { apiClient } from "./apiClient";

export const predictionsService = {
  getAll: (params?: Record<string, unknown>) => apiClient.get("/predictions/", { params }),
  getByTeam: (teamName: string, limit = 1) =>
    apiClient.get("/predictions/", { params: { team_name: teamName, limit } }),
  getTop: () => apiClient.get("/predictions/top"),
  getById: (id: number) => apiClient.get(`/predictions/${id}`),
  getAnalysis: (id: number) => apiClient.get(`/predictions/${id}/analysis`),
  getPreMatch: (id: number) => apiClient.get(`/predictions/${id}/pre-match`),
  getOddsHistory: (id: number) => apiClient.get(`/predictions/${id}/odds-history`),
  generate: (matchId: number) => apiClient.post(`/predictions/generate/${matchId}`),
};
