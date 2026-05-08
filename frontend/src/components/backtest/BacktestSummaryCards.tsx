"use client";

import { motion } from "framer-motion";
import { TrendingUp, Target, DollarSign, Brain } from "lucide-react";
import type { BacktestSummary } from "@/types";

interface Props { summary: BacktestSummary }

export function BacktestSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Total Predictions",
      value: summary.total_predictions.toLocaleString(),
      sub: `${summary.correct_predictions} correct`,
      icon: Target,
      color: "text-neon-blue",
      bg: "bg-neon-blue/10",
    },
    {
      label: "Accuracy",
      value: `${(summary.accuracy * 100).toFixed(1)}%`,
      sub: "Overall hit rate",
      icon: TrendingUp,
      color: "text-neon-green",
      bg: "bg-neon-green/10",
    },
    {
      label: "ROI",
      value: `${summary.roi >= 0 ? "+" : ""}${summary.roi.toFixed(1)}%`,
      sub: "Return on investment",
      icon: DollarSign,
      color: summary.roi >= 0 ? "text-neon-green" : "text-red-400",
      bg: summary.roi >= 0 ? "bg-neon-green/10" : "bg-red-500/10",
    },
    {
      label: "Avg Confidence",
      value: `${summary.avg_confidence.toFixed(1)}%`,
      sub: "Mean AI confidence",
      icon: Brain,
      color: "text-neon-purple",
      bg: "bg-neon-purple/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="glass-card p-5 space-y-3"
        >
          <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
            <p className="text-sm font-medium text-foreground">{card.label}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
