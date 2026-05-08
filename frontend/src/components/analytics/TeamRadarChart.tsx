"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";

interface TeamStats {
  attack: number;
  defense: number;
  form: number;
  elo: number;
  home_advantage: number;
}

interface DualProps {
  home: TeamStats;
  away: TeamStats;
  homeName: string;
  awayName: string;
}

interface SingleProps {
  data: TeamStats;
  teamName: string;
  color?: string;
}

type Props = DualProps | SingleProps;

function isDual(p: Props): p is DualProps {
  return "home" in p && "away" in p;
}

const AXES = [
  { key: "attack",        label: "Attack" },
  { key: "defense",       label: "Defense" },
  { key: "form",          label: "Form" },
  { key: "elo",           label: "ELO" },
  { key: "home_advantage", label: "Home Adv" },
];

export function TeamRadarChart(props: Props) {
  if (isDual(props)) {
    const { home, away, homeName, awayName } = props;
    const chartData = AXES.map(({ key, label }) => ({
      subject: label,
      Home: +((home as any)[key] * 100).toFixed(1),
      Away: +((away as any)[key] * 100).toFixed(1),
    }));

    return (
      <div className="glass-card p-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />
          {homeName}
          <span className="text-muted-foreground mx-1">vs</span>
          <span className="w-2 h-2 rounded-full bg-neon-blue inline-block" />
          {awayName}
          <span className="ml-auto text-xs text-muted-foreground font-normal">Team Radar</span>
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <defs>
              <filter id="radarGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="radarGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <PolarGrid stroke="#30363D" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#7D8590", fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#7D8590", fontSize: 9 }} />
            <Radar
              name={homeName}
              dataKey="Home"
              stroke="#00FF87"
              fill="#00FF87"
              fillOpacity={0.18}
              strokeWidth={2}
              filter="url(#radarGlowGreen)"
            />
            <Radar
              name={awayName}
              dataKey="Away"
              stroke="#00D4FF"
              fill="#00D4FF"
              fillOpacity={0.15}
              strokeWidth={2}
              filter="url(#radarGlowBlue)"
            />
            <Tooltip
              contentStyle={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: "8px", color: "#E6EDF3", fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#7D8590" }}
              formatter={(value) => <span style={{ color: "#E6EDF3" }}>{value}</span>}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Single-team fallback
  const { data, teamName, color = "#00FF87" } = props;
  const chartData = AXES.map(({ key, label }) => ({
    subject: label,
    A: +((data as any)[key] * 100).toFixed(1),
  }));

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

