import { apiClient } from "./apiClient";

export const adminService = {
  getStats: () => apiClient.get("/admin/stats"),

  getUsers: (params?: Record<string, unknown>) => apiClient.get("/admin/users", { params }),
  banUser: (id: string) => apiClient.post(`/admin/users/${id}/ban`),
  unbanUser: (id: string) => apiClient.post(`/admin/users/${id}/unban`),
  setRole: (id: string, role: string) => apiClient.post(`/admin/users/${id}/role`, { role }),
  setSubscription: (id: string, plan: string, status = "active") =>
    apiClient.post(`/admin/users/${id}/subscription`, { plan, status }),

  getPredictions: (params?: Record<string, unknown>) => apiClient.get("/admin/predictions", { params }),
  overridePrediction: (
    id: number,
    body: { confidence_score?: number; recommended_bet?: string; value_bet?: boolean; ai_summary?: string }
  ) => apiClient.patch(`/admin/predictions/${id}`, body),

  ingestRange: (days_back: number) => apiClient.post(`/admin/ingest-range?days_back=${days_back}`),
};
