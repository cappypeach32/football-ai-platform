import { apiClient } from "./apiClient";
import type { Prediction } from "@/types";

export const predictionsService = {
  getAll: (params?: Record<string, unknown>) => apiClient.get("/predictions/", { params }),
  getByTeam: (teamName: string, limit = 1, upcomingOnly = true) =>
    apiClient.get("/predictions/", { params: { team_name: teamName, limit, upcoming_only: upcomingOnly } }),
  getTop: () => apiClient.get("/predictions/top"),
  getHero: (fromDate?: string) =>
    apiClient.get<Prediction>("/predictions/hero", { params: fromDate ? { from_date: fromDate } : {} }),
  getById: (id: number) => apiClient.get(`/predictions/${id}`),
  getAnalysis: (id: number) => apiClient.get(`/predictions/${id}/analysis`),
  getPreMatch: (id: number) => apiClient.get(`/predictions/${id}/pre-match`),
  getOddsHistory: (id: number) => apiClient.get(`/predictions/${id}/odds-history`),
  generate: (matchId: number) => apiClient.post(`/predictions/generate/${matchId}`),
};
