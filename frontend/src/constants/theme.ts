/** Tailwind class names for reuse in JS/TS logic — keeps color tokens in one place. */
export const COLORS = {
  neonGreen:  "text-neon-green",
  neonBlue:   "text-neon-blue",
  neonPurple: "text-neon-purple",
  amber:      "text-amber-400",
  red:        "text-red-400",
  muted:      "text-muted-foreground",
} as const;

export const CONFIDENCE = {
  high:   { min: 70, label: "High",   color: "text-neon-green",  bg: "bg-neon-green/10"  },
  medium: { min: 55, label: "Medium", color: "text-amber-400",   bg: "bg-amber-400/10"   },
  low:    { min: 0,  label: "Low",    color: "text-red-400",     bg: "bg-red-500/10"     },
} as const;

export const OUTCOME_COLORS: Record<string, string> = {
  W: "text-neon-green",
  D: "text-amber-400",
  L: "text-red-400",
};

export const RESULT_BADGE: Record<string, string> = {
  win:     "text-neon-green bg-neon-green/10 border-neon-green/20",
  loss:    "text-red-400 bg-red-500/10 border-red-500/20",
  draw:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  pending: "text-muted-foreground bg-surface-elevated border-surface-border",
};
