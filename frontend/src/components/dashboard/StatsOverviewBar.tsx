"use client";

import { motion, useSpring, useTransform, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
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

function AnimatedStat({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const spring = useSpring(0, { stiffness: 55, damping: 18, restDelta: 0.001 });
  const display = useTransform(spring, (v) => format(v));

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, value, spring]);

  return (
    <motion.span
      ref={ref}
      className="stat-number"
      style={{ display: "inline-block" }}
    >
      {display}
    </motion.span>
  );
}

export function StatsOverviewBar({ overview }: Props) {
  const displayRoi = overview.overall_roi ?? overview.value_bets_roi;

  const stats = [
    {
      label: "Total Predictions",
      value: overview.total_predictions,
      format: (v: number) => Math.round(v).toLocaleString(),
      icon: Target,
      color: "text-neon-blue",
      border: "rgba(0,212,255,0.2)",
      glow: "rgba(0,212,255,0.08)",
      bg: "bg-neon-blue/10",
    },
    {
      label: "Overall Accuracy",
      value: overview.overall_accuracy * 100,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-neon-green",
      border: "rgba(0,255,135,0.2)",
      glow: "rgba(0,255,135,0.08)",
      bg: "bg-neon-green/10",
    },
    {
      label: "Value Bet ROI",
      value: displayRoi,
      format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
      icon: Zap,
      color: displayRoi >= 0 ? "text-neon-green" : "text-red-400",
      border: displayRoi >= 0 ? "rgba(0,255,135,0.2)" : "rgba(248,113,113,0.2)",
      glow: displayRoi >= 0 ? "rgba(0,255,135,0.08)" : "rgba(248,113,113,0.06)",
      bg: displayRoi >= 0 ? "bg-neon-green/10" : "bg-red-500/10",
    },
    {
      label: "Matches Analysed",
      value: overview.total_matches,
      format: (v: number) => Math.round(v).toLocaleString(),
      icon: BarChart2,
      color: "text-neon-purple",
      border: "rgba(139,92,246,0.2)",
      glow: "rgba(139,92,246,0.08)",
      bg: "bg-neon-purple/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: i * 0.07, duration: 0.45, ease: "easeOut" }}
          whileHover={{ y: -3, scale: 1.02 }}
          className="glass-card p-4 flex items-center gap-3 group cursor-default"
          style={{
            transition: "border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = stat.border;
            el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${stat.border}, 0 0 28px ${stat.glow}`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "";
            el.style.boxShadow = "";
          }}
        >
          <div className={`p-2.5 rounded-xl ${stat.bg} flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-xl font-bold font-mono ${stat.color}`}>
              <AnimatedStat value={stat.value} format={stat.format} />
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

