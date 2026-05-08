import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatMatchDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd MMM yyyy, HH:mm");
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd MMM");
}

export function formatTimeAgo(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
}

export function formatScore(home: number | null, away: number | null): string {
  if (home === null || away === null) return "vs";
  return `${home} – ${away}`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatProbabilityToPercent(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function formatOdds(prob: number): string {
  if (prob <= 0) return "N/A";
  return (1 / prob).toFixed(2);
}
