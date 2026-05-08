"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, Zap } from "lucide-react";

interface Props { overview: { total_predictions: number; overall_accuracy: number; value_bets_roi: number; overall_roi?: number; resolved_bets?: number; settled_predictions?: number; total_matches: number; model_accuracy?: Record<string, number> } }

export function OverviewCharts({ overview }: Props) {
  // Use overall_roi if available (from profit_loss data), fallback to value_bets_roi
  const displayRoi = overview.overall_roi ?? overview.value_bets_roi;
  const roiLabel = `${displayRoi >= 0 ? "+" : ""}${displayRoi.toFixed(1)}%`;
  const roiColor = displayRoi > 0 ? "text-neon-green" : displayRoi < 0 ? "text-red-400" : "text-muted-foreground";
  // Use settled predictions count for the accuracy subtitle
  const settledCount = overview.settled_predictions ?? overview.resolved_bets ?? overview.total_predictions;
  const modelAcc = overview.model_accuracy ?? {};
  const modelRows = [
    { name: "Poisson Model",    accuracy: modelAcc["poisson"] ?? 62 },
    { name: "XGBoost Ensemble", accuracy: modelAcc["xgboost"] ?? 71 },
    { name: "ELO System",       accuracy: modelAcc["elo"] ?? 58 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-3 md:col-span-2">
        <h3 className="text-sm font-semibold text-foreground">Platform Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Accuracy", value: `${(overview.overall_accuracy * 100).toFixed(1)}%`, sub: `${settledCount} settled`, color: "text-neon-green" },
            { label: "Predictions", value: overview.total_predictions.toLocaleString(), sub: "total generated", color: "text-neon-blue" },
            { label: "ROI", value: roiLabel, sub: "on settled bets", color: roiColor },
            { label: "Matches", value: overview.total_matches.toLocaleString(), sub: "in database", color: "text-neon-purple" },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI Model Status</h3>
        <div className="space-y-3 mt-4">
          {modelRows.map((m) => (
            <div key={m.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{m.name}</span>
                <span className="text-neon-green">{m.accuracy.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-surface-elevated rounded-full">
                <div className="h-1 rounded-full bg-neon-green/70" style={{ width: `${m.accuracy}%` }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
