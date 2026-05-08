"use client";

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: { attack: number; defense: number; form: number; elo: number; home_advantage: number };
  teamName: string;
  color?: string;
}

export function TeamRadarChart({ data, teamName, color = "#00FF87" }: Props) {
  const chartData = [
    { subject: "Attack",   A: data.attack },
    { subject: "Defense",  A: data.defense },
    { subject: "Form",     A: data.form },
    { subject: "ELO",      A: data.elo },
    { subject: "Home Adv", A: data.home_advantage },
  ];

  return (
    <div className="glass-card p-6 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{teamName} — Radar</h3>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#30363D" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#7D8590", fontSize: 11 }} />
          <Radar name={teamName} dataKey="A" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
          <Tooltip
            contentStyle={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: "8px", color: "#E6EDF3" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
