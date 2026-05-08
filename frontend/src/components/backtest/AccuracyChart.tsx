"use client";

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from "recharts";

interface MonthlyEntry {
  month: string;
  accuracy: number;
  roi: number;
  profit_loss: number;
  count: number;
}

interface Props {
  data: MonthlyEntry[];
}

export function AccuracyChart({ data }: Props) {
  if (!data?.length) return (
    <div className="glass-card p-6 flex items-center justify-center h-64">
      <p className="text-muted-foreground text-sm">No historical data yet</p>
    </div>
  );

  const chartData = data.map((d) => ({
    ...d,
    accuracy_pct: +(d.accuracy * 100).toFixed(1),
  }));

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Monthly Performance</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00FF87] inline-block" />Accuracy %</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#58A6FF] inline-block" />ROI %</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00FF87" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#58A6FF" stopOpacity={0} />
            </linearGradient>
            <filter id="lineGlowGreen" x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="lineGlowBlue" x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
          <XAxis dataKey="month" tick={{ fill: "#7D8590", fontSize: 11 }} />
          <YAxis tick={{ fill: "#7D8590", fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: "8px", color: "#E6EDF3" }}
            formatter={(val: number, name: string) => [`${val}%`, name]}
          />
          <Area type="monotone" dataKey="accuracy_pct" stroke="#00FF87" strokeWidth={2.5} fill="url(#accuracyGrad)" name="Accuracy" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#00FF87" }} filter="url(#lineGlowGreen)" />
          <Area type="monotone" dataKey="roi" stroke="#58A6FF" strokeWidth={2.5} fill="url(#roiGrad)" name="ROI" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#58A6FF" }} filter="url(#lineGlowBlue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
