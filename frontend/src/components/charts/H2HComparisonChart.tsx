"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { motion } from "framer-motion";
import type { H2HResult } from "@/types";

interface Props {
  results: H2HResult[];
  homeName: string;
  awayName: string;
  className?: string;
}

interface StatRow {
  label: string;
  home: number;
  away: number;
  fmt?: (v: number) => string;
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
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 shadow-xl">
      <p className="text-[11px] text-muted-foreground font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs">
          <span className="font-bold font-mono" style={{ color: p.fill }}>{p.value?.toFixed(1)}</span>
          <span className="text-muted-foreground ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

export function H2HComparisonChart({ results, homeName, awayName, className }: Props) {
  if (!results.length) return null;

  // Aggregate stats
  const homeGoals = results.reduce((s, r) => s + r.home_score, 0);
  const awayGoals = results.reduce((s, r) => s + r.away_score, 0);
  const homeWins = results.filter((r) => r.home_score > r.away_score && r.home_team.toLowerCase().includes(homeName.split(" ")[0].toLowerCase())).length;
  const awayWins = results.filter((r) => r.away_score > r.home_score && r.away_team.toLowerCase().includes(awayName.split(" ")[0].toLowerCase())).length;
  const draws = results.filter((r) => r.home_score === r.away_score).length;

  const stats: StatRow[] = [
    { label: "Avg Goals", home: homeGoals / results.length, away: awayGoals / results.length },
    { label: "Max Goals",  home: Math.max(...results.map((r) => r.home_score)), away: Math.max(...results.map((r) => r.away_score)) },
    { label: "Clean Sheets", home: results.filter((r) => r.away_score === 0).length, away: results.filter((r) => r.home_score === 0).length },
  ];

  // Recent H2H results for timeline
  const recent = results.slice(-6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className={`glass-card p-5 space-y-5 ${className ?? ""}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Head to Head</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Last {results.length} meetings</p>
      </div>

      {/* W/D/L summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: homeName.split(" ").at(-1), value: homeWins, color: "#00FF87" },
          { label: "Draws",                   value: draws,    color: "#F5A623" },
          { label: awayName.split(" ").at(-1), value: awayWins, color: "#60CDFF" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="glass-card p-3 rounded-xl"
          >
            <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Stats comparison bars */}
      <ResponsiveContainer width="100%" height={130}>
        <BarChart
          data={stats}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#7D8590", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: "#7D8590", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="home" name={homeName} fill="#00FF87" fillOpacity={0.8} maxBarSize={14} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="home" position="right" style={{ fill: "#00FF87", fontSize: 9 }} formatter={(v: number) => v.toFixed(1)} />
          </Bar>
          <Bar dataKey="away" name={awayName} fill="#60CDFF" fillOpacity={0.8} maxBarSize={14} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="away" position="right" style={{ fill: "#60CDFF", fontSize: 9 }} formatter={(v: number) => v.toFixed(1)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Recent scorelines */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">Recent Meetings</p>
        {recent.map((r, i) => {
          const homeWon = r.home_score > r.away_score;
          const awayWon = r.away_score > r.home_score;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="flex items-center gap-2 text-[11px]"
            >
              <span className="text-muted-foreground w-16 shrink-0 font-mono text-[9px]">{r.date}</span>
              <span className={`flex-1 text-right truncate ${homeWon ? "text-neon-green font-semibold" : "text-muted-foreground"}`}>
                {r.home_team}
              </span>
              <span className="font-mono font-bold text-foreground shrink-0 tabular-nums px-2">
                {r.home_score}–{r.away_score}
              </span>
              <span className={`flex-1 truncate ${awayWon ? "text-neon-blue font-semibold" : "text-muted-foreground"}`}>
                {r.away_team}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
