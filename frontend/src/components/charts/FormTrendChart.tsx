"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { motion } from "framer-motion";
import type { TeamFormEntry } from "@/types";

interface Props {
  entries: TeamFormEntry[];
  teamName: string;
  color?: string;
  className?: string;
}

const RESULT_COLOR = { W: "#00FF87", D: "#F5A623", L: "#F85149" };
const TOOLTIP_STYLE = {
  background: "#1C2128",
  border: "1px solid #30363D",
  borderRadius: "10px",
  color: "#E6EDF3",
  fontSize: "12px",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 shadow-xl">
      <p className="text-[11px] font-semibold text-foreground">{d?.home_or_away} {d?.opponent}</p>
      <p className="text-[10px] text-muted-foreground">{d?.date}</p>
      <p className="text-xs font-mono">
        <span style={{ color: RESULT_COLOR[d?.result as keyof typeof RESULT_COLOR] || "#7D8590" }} className="font-bold">
          {d?.result}
        </span>
        <span className="text-muted-foreground ml-2">{d?.goals_for}–{d?.goals_against}</span>
      </p>
    </div>
  );
}

export function FormTrendChart({ entries, teamName, color = "#00FF87", className }: Props) {
  if (!entries.length) return null;

  // Last 10 matches, chronological
  const data = entries.slice(-10).map((e, i) => ({
    ...e,
    idx: i + 1,
    goal_diff: e.goals_for - e.goals_against,
    pts: e.result === "W" ? 3 : e.result === "D" ? 1 : 0,
  }));

  // Rolling avg goals scored (simple)
  const avgScored = data.reduce((s, d) => s + d.goals_for, 0) / data.length;
  const wins = data.filter((d) => d.result === "W").length;
  const points = data.reduce((s, d) => s + d.pts, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`glass-card p-5 space-y-4 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{teamName} — Form</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Last {data.length} matches</p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <div className="text-center">
            <p className="font-mono font-bold text-neon-green">{wins}W</p>
            <p className="text-muted-foreground">Wins</p>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold text-foreground">{points}pts</p>
            <p className="text-muted-foreground">Points</p>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold" style={{ color }}>{avgScored.toFixed(1)}</p>
            <p className="text-muted-foreground">Avg gf</p>
          </div>
        </div>
      </div>

      {/* Result badges row */}
      <div className="flex gap-1.5 flex-wrap">
        {data.map((d, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.04 }}
            style={{ backgroundColor: `${RESULT_COLOR[d.result as keyof typeof RESULT_COLOR]}20`, color: RESULT_COLOR[d.result as keyof typeof RESULT_COLOR], borderColor: `${RESULT_COLOR[d.result as keyof typeof RESULT_COLOR]}40` }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border"
            title={`${d.home_or_away} ${d.opponent} ${d.goals_for}-${d.goals_against}`}
          >
            {d.result}
          </motion.span>
        ))}
      </div>

      {/* Goals bars */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
          <XAxis
            dataKey="idx"
            tick={{ fill: "#7D8590", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `M${v}`}
          />
          <YAxis
            tick={{ fill: "#7D8590", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="goals_for" name="Scored" maxBarSize={20} radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={RESULT_COLOR[entry.result as keyof typeof RESULT_COLOR] || "#7D8590"} fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="goals_against" name="Conceded" maxBarSize={20} radius={[3, 3, 0, 0]} fill="#7D8590" fillOpacity={0.35} />
          <Line
            type="monotone"
            dataKey="pts"
            stroke={color}
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-[9px] text-muted-foreground text-center">
        Bars: goals scored (coloured by result) / conceded (grey) · Dashed: points trend
      </p>
    </motion.div>
  );
}
