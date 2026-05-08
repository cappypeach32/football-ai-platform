"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { predictionsApi } from "@/lib/api";
import type { OddsHistory, OddsSnapshot } from "@/types";

interface Props {
  predictionId: number;
  homeTeam: string;
  awayTeam: string;
}

type MarketKey = "home" | "draw" | "away";

const MARKETS: { key: MarketKey; label: string; color: string }[] = [
  { key: "home", label: "Home", color: "#00FF87" },
  { key: "draw", label: "Draw", color: "#FBBF24" },
  { key: "away", label: "Away", color: "#00D4FF" },
];

function MovementBadge({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "up")
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400">
        <TrendingUp className="w-3 h-3" /> UP
      </span>
    );
  if (direction === "down")
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neon-green">
        <TrendingDown className="w-3 h-3" /> DOWN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
      <Minus className="w-3 h-3" /> STABLE
    </span>
  );
}

function OddsTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated/95 backdrop-blur-sm border border-surface-border/70 rounded-xl px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono font-bold text-foreground">{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function OddsTracker({ predictionId, homeTeam, awayTeam }: Props) {
  const [shown, setShown] = useState<Set<MarketKey>>(new Set(["home", "draw", "away"]));

  const toggle = (key: MarketKey) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });

  const { data, isLoading, error, refetch, isFetching } = useQuery<OddsHistory>({
    queryKey: ["odds-history", predictionId],
    queryFn: () => predictionsApi.getOddsHistory(predictionId).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const chartData = (data?.history ?? []).map((s: OddsSnapshot) => ({
    time: (() => { try { return format(parseISO(s.timestamp), "HH:mm"); } catch { return ""; } })(),
    home: s.home,
    draw: s.draw,
    away: s.away,
  }));

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-neon-amber/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-neon-amber" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.7))" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Live Odds Tracker</h3>
            <p className="text-xs text-muted-foreground">24h movement</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
          title="Refresh odds"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Current odds pills */}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          {MARKETS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                "rounded-xl p-3 border text-center transition-all duration-200",
                shown.has(key)
                  ? "bg-surface-navy/80 border-surface-border/80"
                  : "bg-surface-navy/30 border-surface-border/30 opacity-40"
              )}
              style={shown.has(key) ? { boxShadow: `0 0 12px ${color}22` } : {}}
            >
              <p className="text-[10px] text-muted-foreground mb-1 truncate">
                {key === "home" ? homeTeam : key === "away" ? awayTeam : "Draw"}
              </p>
              <p className="text-xl font-bold font-mono" style={{ color }}>
                {data.current[key].toFixed(2)}
              </p>
              <MovementBadge direction={data.movement[key]} />
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      {isLoading && <div className="h-44 rounded-xl bg-surface-elevated animate-pulse" />}
      {error && (
        <div className="h-44 rounded-xl bg-surface-elevated/50 flex items-center justify-center text-xs text-muted-foreground">
          Could not load odds history
        </div>
      )}
      {data && chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="h-44"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                {MARKETS.map(({ key, color }) => (
                  <filter key={key} id={`odds-glow-${key}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                ))}
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "rgba(148,163,184,0.5)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(148,163,184,0.5)" }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v) => Number(v).toFixed(1)}
              />
              <Tooltip content={<OddsTooltip />} />
              {MARKETS.filter((m) => shown.has(m.key)).map(({ key, label, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                  filter={`url(#odds-glow-${key})`}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        {MARKETS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <div
              className="w-4 h-0.5 rounded-full transition-opacity"
              style={{ backgroundColor: color, opacity: shown.has(key) ? 1 : 0.25 }}
            />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
