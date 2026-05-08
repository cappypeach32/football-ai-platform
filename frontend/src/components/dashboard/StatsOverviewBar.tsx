"use client";

import { motion } from "framer-motion";
import { TrendingUp, Target, Zap, BarChart2 } from "lucide-react";

interface Props {
  overview: {
    total_predictions: number;
    overall_accuracy: number;
    value_bets_roi: number;
    overall_roi?: number;
    total_matches: number;
  };
}

export function StatsOverviewBar({ overview }: Props) {
  const displayRoi = overview.overall_roi ?? overview.value_bets_roi;
  const stats = [
    {
      label: "Total Predictions",
      value: overview.total_predictions.toLocaleString(),
      icon: Target,
      color: "text-neon-blue",
      bg: "bg-neon-blue/10",
    },
    {
      label: "Overall Accuracy",
      value: `${(overview.overall_accuracy * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-neon-green",
      bg: "bg-neon-green/10",
    },
    {
      label: "Value Bet ROI",
      value: `${displayRoi >= 0 ? "+" : ""}${displayRoi.toFixed(1)}%`,
      icon: Zap,
      color: displayRoi >= 0 ? "text-neon-green" : "text-red-400",
      bg: displayRoi >= 0 ? "bg-neon-green/10" : "bg-red-500/10",
    },
    {
      label: "Matches Analysed",
      value: overview.total_matches.toLocaleString(),
      icon: BarChart2,
      color: "text-neon-purple",
      bg: "bg-neon-purple/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-4 flex items-center gap-3 hover-glow-green group"
        >
          <div className={`p-2 rounded-lg ${stat.bg} flex-shrink-0`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
