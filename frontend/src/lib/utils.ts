import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatConfidence(score: number): { label: string; className: string } {
  if (score >= 75) return { label: "High", className: "confidence-high" };
  if (score >= 55) return { label: "Medium", className: "confidence-medium" };
  return { label: "Low", className: "confidence-low" };
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function formatOdds(prob: number): string {
  if (prob <= 0) return "N/A";
  return (1 / prob).toFixed(2);
}

export function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case "W": return "text-emerald-400";
    case "D": return "text-amber-400";
    case "L": return "text-red-400";
    default:  return "text-muted-foreground";
  }
}
