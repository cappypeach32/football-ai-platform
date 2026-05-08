import { apiClient } from "./apiClient";

export const analyticsService = {
  getOverview: () => apiClient.get("/analytics/overview"),
  getLeagueStats: () => apiClient.get("/analytics/leagues"),
  getTeamForm: (id: number, lastN = 10) =>
    apiClient.get(`/analytics/team/${id}/form`, { params: { last_n: lastN } }),
  getTeamRadar: (id: number) => apiClient.get(`/analytics/team/${id}/radar`),
  getH2H: (homeId: number, awayId: number) =>
    apiClient.get("/analytics/comparison", { params: { home_id: homeId, away_id: awayId } }),
  getAlerts: () => apiClient.get("/analytics/alerts"),
  getDailySummary: () => apiClient.get("/analytics/daily-summary"),
};
