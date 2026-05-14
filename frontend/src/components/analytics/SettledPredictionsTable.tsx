"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { format } from "date-fns";

const BET_LABEL: Record<string, string> = {
  "1": "Home Win",
  X: "Draw",
  "2": "Away Win",
  over_2_5: "Over 2.5",
  under_2_5: "Under 2.5",
  btts_yes: "BTTS Yes",
  btts_no: "BTTS No",
};

function betLabel(bet: string | null) {
  if (!bet) return "—";
  return BET_LABEL[bet] ?? bet;
}

interface SettledRow {
  prediction_id: number;
  match_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string | null;
  score: string | null;
  recommended_bet: string | null;
  result: "win" | "loss" | "draw" | null;
  is_correct: boolean | null;
  odds: number | null;
  profit_loss: number | null;
  confidence_score: number | null;
  value_bet: boolean;
}

export function SettledPredictionsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "settled-predictions"],
    queryFn: () => analyticsApi.getSettledPredictions().then((r) => r.data),
  });

  const rows: SettledRow[] = data?.predictions ?? [];
  const roi: number = data?.roi ?? 0;
  const totalPl: number = data?.total_pl ?? 0;
  const total: number = data?.total ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            Settled Predictions Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All resolved bets — result, odds, and P&amp;L per pick
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-muted-foreground">
            {total} settled
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold ${
              roi >= 0
                ? "bg-neon-green/10 border border-neon-green/30 text-neon-green"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            ROI {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold ${
              totalPl >= 0
                ? "bg-neon-green/10 border border-neon-green/30 text-neon-green"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            P&amp;L {totalPl >= 0 ? "+" : ""}{totalPl.toFixed(2)}u
          </span>
        </div>
      </div>

      {/* ROI formula explainer */}
      <div className="mb-4 p-3 rounded-lg bg-surface-elevated border border-border/50 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">ROI formula</span>
        {" — "}1-unit flat staking per bet.{" "}
        <span className="font-mono text-neon-green">Win</span>: profit&nbsp;=&nbsp;(odds&nbsp;−&nbsp;1) × 1u.{" "}
        <span className="font-mono text-red-400">Loss</span>: profit&nbsp;=&nbsp;−1u.{" "}
        <span className="font-semibold text-foreground">ROI</span>&nbsp;=&nbsp;Σ profit / n bets × 100.
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No settled predictions yet. Run the backtest reconciler to process finished matches.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/50">
                <th className="text-left pb-2 pr-3 font-medium">Date</th>
                <th className="text-left pb-2 pr-3 font-medium">Match</th>
                <th className="text-left pb-2 pr-3 font-medium">League</th>
                <th className="text-left pb-2 pr-3 font-medium">Bet</th>
                <th className="text-center pb-2 pr-3 font-medium">Score</th>
                <th className="text-center pb-2 pr-3 font-medium">Result</th>
                <th className="text-right pb-2 pr-3 font-medium">Odds</th>
                <th className="text-right pb-2 pr-3 font-medium">Conf.</th>
                <th className="text-right pb-2 font-medium">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((row, i) => (
                <motion.tr
                  key={row.prediction_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="hover:bg-surface-elevated/50 transition-colors"
                >
                  {/* Date */}
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                    {row.match_date ? format(new Date(row.match_date), "dd MMM yy") : "—"}
                  </td>

                  {/* Match */}
                  <td className="py-2.5 pr-3 font-medium text-foreground whitespace-nowrap">
                    <span className="text-xs">
                      {row.home_team} <span className="text-muted-foreground">vs</span> {row.away_team}
                    </span>
                  </td>

                  {/* League */}
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
                    {row.league}
                  </td>

                  {/* Bet */}
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1 text-xs">
                      {row.value_bet && <Zap className="w-3 h-3 text-neon-green" title="Value bet" />}
                      <span className="font-mono text-neon-blue">{betLabel(row.recommended_bet)}</span>
                    </span>
                  </td>

                  {/* Score */}
                  <td className="py-2.5 pr-3 text-center font-mono text-xs text-foreground">
                    {row.score ?? "—"}
                  </td>

                  {/* Result badge */}
                  <td className="py-2.5 pr-3 text-center">
                    {row.result === "win" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-neon-green">
                        <CheckCircle2 className="w-3.5 h-3.5" /> WIN
                      </span>
                    ) : row.result === "loss" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> LOSS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> —
                      </span>
                    )}
                  </td>

                  {/* Odds */}
                  <td className="py-2.5 pr-3 text-right font-mono text-xs text-foreground">
                    {row.odds != null ? row.odds.toFixed(2) : "—"}
                  </td>

                  {/* Confidence */}
                  <td className="py-2.5 pr-3 text-right text-xs">
                    <span
                      className={
                        (row.confidence_score ?? 0) >= 0.7
                          ? "text-neon-green"
                          : (row.confidence_score ?? 0) >= 0.5
                          ? "text-yellow-400"
                          : "text-muted-foreground"
                      }
                    >
                      {row.confidence_score != null ? `${(row.confidence_score * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>

                  {/* P&L */}
                  <td className="py-2.5 text-right font-mono text-xs font-semibold">
                    {row.profit_loss != null ? (
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          row.profit_loss >= 0 ? "text-neon-green" : "text-red-400"
                        }`}
                      >
                        {row.profit_loss >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {row.profit_loss >= 0 ? "+" : ""}
                        {row.profit_loss.toFixed(2)}u
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
