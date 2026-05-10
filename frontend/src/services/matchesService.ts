import { apiClient } from "./apiClient";
import type { EspnLiveResponse, MatchLineup } from "@/types";

export const matchesService = {
  getAll: (params?: Record<string, unknown>) => apiClient.get("/matches/", { params }),
  getToday: () => apiClient.get("/matches/today"),
  getLive: () => apiClient.get("/matches/live"),
  getById: (id: number) => apiClient.get(`/matches/${id}`),
  getEspnLive: () => apiClient.get<EspnLiveResponse>("/live/matches"),
  getLineup: (leagueSlug: string, eventId: string) =>
    apiClient.get<MatchLineup>(`/live/lineup/${leagueSlug}/${eventId}`),
};

export const teamsService = {
  getAll: (params?: Record<string, unknown>) => apiClient.get("/teams/", { params }),
  getById: (id: number) => apiClient.get(`/teams/${id}`),
  getPlayers: (id: number) => apiClient.get(`/teams/${id}/players`),
  getInjuries: (id: number) => apiClient.get(`/teams/${id}/injuries`),
};
