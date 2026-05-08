"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

interface Props {
  homeName: string;
  awayName: string;
  homeProb: number;   // 0-1
  drawProb: number;   // 0-1
  awayProb: number;   // 0-1
  className?: string;
}

const SEGMENTS = [
  { key: "home", label: "Home Win", color: "#00FF87" },
  { key: "draw", label: "Draw",     color: "#F5A623" },
  { key: "away", label: "Away Win", color: "#60CDFF" },
];

const TOOLTIP_STYLE = {
  background: "#1C2128",
  border: "1px solid #30363D",
  borderRadius: "10px",
  color: "#E6EDF3",
  fontSize: "12px",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold" style={{ color: item.payload.color }}>{item.name}</p>
      <p className="text-sm font-mono font-bold text-foreground">{(item.value * 100).toFixed(1)}%</p>
    </div>
  );
}

export function WinProbabilityGauge({ homeName, awayName, homeProb, drawProb, awayProb, className }: Props) {
  const data = [
    { name: homeName,  value: homeProb, color: "#00FF87", key: "home" },
    { name: "Draw",    value: drawProb, color: "#F5A623", key: "draw" },
    { name: awayName,  value: awayProb, color: "#60CDFF", key: "away" },
  ];

  // Find the dominant outcome
  const dominant = data.reduce((a, b) => (a.value > b.value ? a : b));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`glass-card p-5 space-y-3 ${className ?? ""}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Win Probability</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">AI model output</p>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center pointer-events-none">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold font-mono"
            style={{ color: dominant.color }}
          >
            {(dominant.value * 100).toFixed(0)}%
          </motion.p>
          <p className="text-[10px] text-muted-foreground">{dominant.name}</p>
        </div>
      </div>

      {/* Legend bars */}
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-20 shrink-0 truncate">{d.name}</span>
            <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${d.value * 100}%` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full"
                style={{ backgroundColor: d.color }}
              />
            </div>
            <span className="text-xs font-mono font-semibold w-10 text-right" style={{ color: d.color }}>
              {(d.value * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
