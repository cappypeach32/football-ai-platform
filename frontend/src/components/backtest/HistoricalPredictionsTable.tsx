"use client";

import { useQuery } from "@tanstack/react-query";
import { backtestApi } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Prediction } from "@/types";

export function HistoricalPredictionsTable() {
  const { data } = useQuery({
    queryKey: ["backtest", "predictions"],
    queryFn: () => backtestApi.getHistorical({ limit: 20 }).then((r) => r.data as Prediction[]),
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-foreground">Historical Predictions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {["Match", "Date", "Prediction", "Confidence", "Result", "P&L"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(data ?? []).map((pred) => (
              <tr key={pred.id} className="hover:bg-surface-card/50 transition-colors">
                <td className="px-4 py-3 text-foreground">
                  {pred.match.home_team.short_name ?? pred.match.home_team.name} vs{" "}
                  {pred.match.away_team.short_name ?? pred.match.away_team.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(pred.match.match_date), "dd MMM")}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono">{pred.recommended_bet ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-foreground">{pred.confidence_score.toFixed(0)}%</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "stat-badge text-xs",
                    pred.is_correct === true  ? "bg-emerald-500/15 text-emerald-400" :
                    pred.is_correct === false ? "bg-red-500/15 text-red-400" :
                    "bg-surface-elevated text-muted-foreground"
                  )}>
                    {pred.is_correct === true ? "✓ Win" : pred.is_correct === false ? "✗ Loss" : "Pending"}
                  </span>
                </td>
                <td className={cn(
                  "px-4 py-3 font-mono text-sm",
                  pred.profit_loss != null && pred.profit_loss >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {pred.profit_loss != null ? `${pred.profit_loss >= 0 ? "+" : ""}${pred.profit_loss.toFixed(2)}u` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
