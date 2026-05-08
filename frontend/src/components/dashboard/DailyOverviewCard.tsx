"use client";

import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, TrendingUp, Zap } from "lucide-react";

interface DailySummary {
  today_predictions: number;
  today_value_bets: number;
  settled_today: number;
  accuracy_today: number;
  roi_today: number;
  profit_loss_today: number;
}

interface Props {
  daily: DailySummary | undefined;
}

export function DailyOverviewCard({ daily }: Props) {
  const rows = [
    {
      icon: CalendarDays,
      label: "Predictions Today",
      value: daily?.today_predictions ?? 0,
      color: "text-neon-blue",
      bg: "bg-neon-blue/10",
    },
    {
      icon: Zap,
      label: "Value Bets",
      value: daily?.today_value_bets ?? 0,
      color: "text-neon-green",
      bg: "bg-neon-green/10",
    },
    {
      icon: CheckCircle2,
      label: "Settled",
      value: daily?.settled_today ?? 0,
      color: "text-neon-purple",
      bg: "bg-neon-purple/10",
    },
    {
      icon: TrendingUp,
      label: "ROI Today",
      value: daily ? `${daily.roi_today >= 0 ? "+" : ""}${daily.roi_today.toFixed(1)}%` : "—",
      color: (daily?.roi_today ?? 0) >= 0 ? "text-neon-green" : "text-red-400",
      bg: (daily?.roi_today ?? 0) >= 0 ? "bg-neon-green/10" : "bg-red-500/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-4 h-full"
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" />
        Daily Overview
      </h3>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="flex items-center gap-3"
          >
            <div className={`p-1.5 rounded-lg ${row.bg} flex-shrink-0`}>
              <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
            </div>
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className={`text-sm font-bold font-mono ${row.color}`}>{row.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* P&L bar */}
      {daily && daily.settled_today > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Accuracy today</span>
            <span className="font-mono text-foreground">{(daily.accuracy_today * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-surface-elevated rounded-full h-1.5">
            <motion.div
              className={`h-1.5 rounded-full ${daily.accuracy_today >= 0.5 ? "bg-neon-green" : "bg-amber-400"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(daily.accuracy_today * 100, 100)}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
