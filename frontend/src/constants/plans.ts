export const PLANS = {
  free:    { label: "Free",    price: 0,     color: "text-muted-foreground", badge: "bg-surface-border" },
  premium: { label: "Premium", price: 9.99,  color: "text-neon-blue",       badge: "bg-neon-blue/10 border-neon-blue/30 text-neon-blue" },
  vip:     { label: "VIP",     price: 24.99, color: "text-amber-400",        badge: "bg-amber-400/10 border-amber-400/30 text-amber-400" },
} as const;

export type PlanKey = keyof typeof PLANS;

export const ROLES = {
  user:      { label: "User",      badge: "bg-surface-elevated text-muted-foreground border-surface-border" },
  admin:     { label: "Admin",     badge: "bg-neon-purple/10 border-neon-purple/30 text-neon-purple" },
  moderator: { label: "Moderator", badge: "bg-neon-blue/10 border-neon-blue/30 text-neon-blue" },
} as const;

export type RoleKey = keyof typeof ROLES;
