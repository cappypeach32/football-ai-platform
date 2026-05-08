export const ROUTES = {
  home:        "/",
  login:       "/login",
  predictions: "/predictions",
  live:        "/live",
  analytics:   "/analytics",
  backtest:    "/backtest",
  admin:       "/admin",
  adminUsers:  "/admin/users",
  adminPredictions: "/admin/predictions",
  prediction:  (id: number) => `/predictions/${id}`,
  preMatch:    (id: number) => `/predictions/${id}/pre-match`,
} as const;
