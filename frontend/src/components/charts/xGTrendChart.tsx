"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { motion } from "framer-motion";

interface xGEntry {
  match: string;        // short label, e.g. "vs Chelsea"
  home_xg: number;
  away_xg: number;
  home_goals?: number;
  away_goals?: number;
}

interface Props {
  data: xGEntry[];
  homeName: string;
  awayName: string;
  className?: string;
}

const TOOLTIP_STYLE = {
  background: "#1C2128",
  border: "1px solid #30363D",
  borderRadius: "10px",
  color: "#E6EDF3",
  fontSize: "12px",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const home = payload.find((p: any) => p.dataKey === "home_xg");
  const away = payload.find((p: any) => p.dataKey === "away_xg");
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 shadow-xl">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      {home && (
        <p className="text-xs">
          <span className="text-neon-green font-mono font-bold">{home.value?.toFixed(2)}</span>
          <span className="text-muted-foreground ml-1">xG (home)</span>
        </p>
      )}
      {away && (
        <p className="text-xs">
          <span className="text-neon-blue font-mono font-bold">{away.value?.toFixed(2)}</span>
          <span className="text-muted-foreground ml-1">xG (away)</span>
        </p>
      )}
    </div>
  );
}

export function XGTrendChart({ data, homeName, awayName, className }: Props) {
  if (!data.length) return null;

  const avgHome = data.reduce((s, d) => s + d.home_xg, 0) / data.length;
  const avgAway = data.reduce((s, d) => s + d.away_xg, 0) / data.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`glass-card p-5 space-y-4 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">xG Trend</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Expected goals per match</p>
        </div>
        <div className="flex gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />
            <span className="text-muted-foreground">{homeName}</span>
            <span className="font-mono font-bold text-neon-green">{avgHome.toFixed(2)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-blue inline-block" />
            <span className="text-muted-foreground">{awayName}</span>
            <span className="font-mono font-bold text-neon-blue">{avgAway.toFixed(2)}</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="xg-home" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00FF87" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="xg-away" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60CDFF" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#60CDFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
          <XAxis
            dataKey="match"
            tick={{ fill: "#7D8590", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#7D8590", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={1.5} stroke="#30363D" strokeDasharray="4 4" label={{ value: "1.5", position: "right", fill: "#7D8590", fontSize: 9 }} />
          <Area
            type="monotone"
            dataKey="home_xg"
            stroke="#00FF87"
            strokeWidth={2}
            fill="url(#xg-home)"
            dot={{ fill: "#00FF87", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#00FF87" }}
          />
          <Area
            type="monotone"
            dataKey="away_xg"
            stroke="#60CDFF"
            strokeWidth={2}
            fill="url(#xg-away)"
            dot={{ fill: "#60CDFF", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#60CDFF" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
