import { apiClient } from "./apiClient";

export const backtestService = {
  getSummary: (params?: Record<string, unknown>) => apiClient.get("/backtest/summary", { params }),
  getHistorical: (params?: Record<string, unknown>) => apiClient.get("/backtest/predictions", { params }),
  reconcile: () => apiClient.post("/backtest/reconcile"),
  getCalibration: () => apiClient.get("/backtest/calibration"),
  ingestRange: (days_back: number) => apiClient.post(`/admin/ingest-range?days_back=${days_back}`),
};
